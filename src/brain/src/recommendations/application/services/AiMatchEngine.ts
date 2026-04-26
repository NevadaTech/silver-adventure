import { Inject, Injectable } from '@nestjs/common'
import { CIIU_TAXONOMY_REPOSITORY } from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import type { CiiuTaxonomyRepository } from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'
import { AI_MATCH_CACHE_REPOSITORY } from '@/recommendations/domain/repositories/AiMatchCacheRepository'
import type { AiMatchCacheRepository } from '@/recommendations/domain/repositories/AiMatchCacheRepository'
import {
  isRelationType,
  type RelationType,
} from '@/recommendations/domain/value-objects/RelationType'
import {
  ECOSYSTEMS,
  VALUE_CHAIN_RULES,
} from '@/recommendations/application/services/ValueChainRules'
import { LLM_PORT } from '@/shared/shared.module'
import type { LlmPort } from '@/shared/domain/LlmPort'
import { env } from '@/shared/infrastructure/env'

export interface InferredMatch {
  hasMatch: boolean
  relationType: RelationType | null
  confidence: number
  reason: string
}

const SAME_CIIU_CONFIDENCE = 0.85
const SAME_CIIU_REASON =
  'Misma actividad económica — referentes mutuos del mismo sector'

@Injectable()
export class AiMatchEngine {
  constructor(
    @Inject(LLM_PORT) private readonly gemini: LlmPort,
    @Inject(AI_MATCH_CACHE_REPOSITORY)
    private readonly cache: AiMatchCacheRepository,
    @Inject(CIIU_TAXONOMY_REPOSITORY)
    private readonly ciiuRepo: CiiuTaxonomyRepository,
  ) {}

  async evaluate(
    ciiuOrigen: string,
    ciiuDestino: string,
  ): Promise<InferredMatch> {
    if (ciiuOrigen === ciiuDestino) {
      const result: InferredMatch = {
        hasMatch: true,
        relationType: 'referente',
        confidence: SAME_CIIU_CONFIDENCE,
        reason: SAME_CIIU_REASON,
      }
      await this.persist(ciiuOrigen, ciiuDestino, result)
      return result
    }

    const cached = await this.cache.get(ciiuOrigen, ciiuDestino)
    if (cached) {
      return {
        hasMatch: cached.hasMatch,
        relationType: cached.relationType,
        confidence: cached.confidence ?? 0,
        reason: cached.reason ?? '',
      }
    }

    const [origen, destino] = await Promise.all([
      this.ciiuRepo.findByCode(ciiuOrigen),
      this.ciiuRepo.findByCode(ciiuDestino),
    ])
    if (!origen || !destino) {
      const result: InferredMatch = {
        hasMatch: false,
        relationType: null,
        confidence: 0,
        reason: 'No DIAN data for one or both CIIUs',
      }
      await this.persist(ciiuOrigen, ciiuDestino, result)
      return result
    }

    const applicableRules = VALUE_CHAIN_RULES.filter(
      (r) =>
        (r.ciiuOrigen === ciiuOrigen &&
          (r.ciiuDestino === ciiuDestino || r.ciiuDestino === '*')) ||
        (r.ciiuOrigen === ciiuDestino &&
          (r.ciiuDestino === ciiuOrigen || r.ciiuDestino === '*')),
    )
    const applicableEcosystems = ECOSYSTEMS.filter(
      (e) =>
        e.ciiuCodes.includes(ciiuOrigen) && e.ciiuCodes.includes(ciiuDestino),
    )

    const rulesBlock =
      applicableRules.length > 0
        ? applicableRules
            .map(
              (r) =>
                `- CIIU ${r.ciiuOrigen} → CIIU ${r.ciiuDestino}: ${r.description} (peso ${r.weight})`,
            )
            .join('\n')
        : '(ninguna regla hardcoded aplica directamente — usa tu criterio)'

    const ecosystemsBlock =
      applicableEcosystems.length > 0
        ? applicableEcosystems
            .map(
              (e) =>
                `- Ecosistema "${e.name}": ${e.description}. CIIUs miembros: ${e.ciiuCodes.join(', ')}`,
            )
            .join('\n')
        : '(no comparten ecosistema hardcoded — usa tu criterio)'

    const prompt = `Sos un analista de negocios colombiano experto en cadenas de valor del Magdalena.

CONOCIMIENTO PREVIO (úsalo como GUÍA, podés extender o desviar si ves algo razonable):

Reglas conocidas que aplican a este par:
${rulesBlock}

Ecosistemas que comparten estos CIIUs:
${ecosystemsBlock}

PAR A EVALUAR:
- Actividad A (origen): CIIU ${origen.code} — ${origen.titulo}
  Sección: ${origen.seccion} (${origen.tituloSeccion})
  División: ${origen.division} (${origen.tituloDivision})
- Actividad B (destino): CIIU ${destino.code} — ${destino.titulo}
  Sección: ${destino.seccion} (${destino.tituloSeccion})
  División: ${destino.division} (${destino.tituloDivision})

TAREA: ¿Tiene sentido recomendarle a una empresa con CIIU ${origen.code} otra empresa con CIIU ${destino.code}? Si sí, ¿qué tipo de relación tendrían?

REGLAS DE TIPO:
- "referente": misma o muy similar actividad → sirven de referencia mutua
- "cliente": A le VENDE su producto/servicio a B
- "proveedor": A le COMPRA su producto/servicio a B
- "aliado": sirven al MISMO cliente final, complementarios horizontalmente, no se compiten
- null: no hay relación de negocio razonable

CONFIDENCE:
- 0.85+ si la relación es muy clara y común en Colombia
- 0.65-0.85 si es razonable pero depende del subsegmento
- 0.5-0.65 si es plausible pero menos común
- < 0.5 → marcá has_match: false

Responde SOLO con JSON, sin explicaciones adicionales, sin markdown:
{
  "has_match": true | false,
  "relation_type": "referente" | "cliente" | "proveedor" | "aliado" | null,
  "confidence": 0.0,
  "reason": "frase corta en español explicando POR QUÉ se relacionan (no copiar literal el título del CIIU)"
}`

    const result = await this.gemini.inferStructured<InferredMatch>(
      prompt,
      validateInferredMatch,
    )
    await this.persist(ciiuOrigen, ciiuDestino, result)
    return result
  }

  private async persist(
    ciiuOrigen: string,
    ciiuDestino: string,
    result: InferredMatch,
  ): Promise<void> {
    await this.cache.put(
      AiMatchCacheEntry.create({
        ciiuOrigen,
        ciiuDestino,
        hasMatch: result.hasMatch,
        relationType: result.hasMatch ? result.relationType : null,
        confidence: result.hasMatch ? result.confidence : null,
        reason: result.reason || null,
        modelVersion: env.GEMINI_CHAT_MODEL,
      }),
    )
  }
}

function validateInferredMatch(raw: unknown): InferredMatch {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('AiMatchEngine: expected object response from Gemini')
  }
  const r = raw as Record<string, unknown>
  const confidence =
    typeof r.confidence === 'number'
      ? Math.max(0, Math.min(1, r.confidence))
      : 0
  const relationType =
    typeof r.relation_type === 'string' && isRelationType(r.relation_type)
      ? r.relation_type
      : null
  const hasMatch = r.has_match === true && relationType !== null
  return {
    hasMatch,
    relationType,
    confidence,
    reason: typeof r.reason === 'string' ? r.reason : '',
  }
}
