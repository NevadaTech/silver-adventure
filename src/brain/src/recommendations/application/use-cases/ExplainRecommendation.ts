import { Inject, Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import {
  findEcosystemsContaining,
  findRulesForPair,
  type Ecosystem,
  type ValueChainRule,
} from '@/recommendations/application/services/ValueChainRules'
import type { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { RECOMMENDATION_REPOSITORY } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RecommendationRepository } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { ReasonFeature } from '@/recommendations/domain/value-objects/Reason'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'
import type { LlmPort } from '@/shared/domain/LlmPort'
import type { UseCase } from '@/shared/domain/UseCase'
import { LLM_PORT } from '@/shared/shared.module'

export interface ExplainRecommendationInput {
  recommendationId: string
}

export interface ExplainRecommendationResult {
  explanation: string
}

interface RelationGlossaryEntry {
  label: string
  definition: string
}

const RELATION_GLOSSARY: Record<RelationType, RelationGlossaryEntry> = {
  cliente: {
    label: 'Cliente potencial',
    definition:
      'La empresa target consume o adquiere los productos / servicios que la empresa source ofrece. Es un canal de demanda: el target compra a la source.',
  },
  proveedor: {
    label: 'Proveedor potencial',
    definition:
      'La empresa target suministra insumos, materias primas o servicios necesarios para la operación de la empresa source. Es un canal de oferta: la source compra a la target.',
  },
  referente: {
    label: 'Empresa referente / par',
    definition:
      'Empresa del mismo sector y actividad económica, útil como benchmark, para intercambio de buenas prácticas, redes gremiales, mentoría informal o aprendizaje cruzado. No compite directamente — se aprende de ella.',
  },
  aliado: {
    label: 'Aliado estratégico',
    definition:
      'Empresa de actividad complementaria dentro del mismo ecosistema económico. Ideal para alianzas comerciales, ofertas conjuntas (bundling), cross-selling, eventos compartidos o referidos mutuos.',
  },
}

const FEATURE_LABELS: Record<ReasonFeature, string> = {
  mismo_ciiu_clase: 'Comparten la misma clase CIIU (actividad muy similar)',
  mismo_ciiu_division: 'Pertenecen a la misma división CIIU',
  mismo_ciiu_seccion: 'Operan en la misma sección CIIU',
  mismo_municipio: 'Operan en el mismo municipio',
  misma_etapa: 'Comparten la misma etapa de madurez empresarial',
  misma_macro_sector: 'Pertenecen al mismo macro-sector económico',
  cadena_valor_directa:
    'Existe una cadena de valor directa identificada entre los CIIUs',
  cadena_valor_inversa:
    'Existe una cadena de valor inversa identificada entre los CIIUs',
  ecosistema_compartido:
    'Comparten un ecosistema económico identificado por los matchers',
  ai_inferido: 'La IA infirió la relación analizando ambos CIIUs',
}

@Injectable()
export class ExplainRecommendation implements UseCase<
  ExplainRecommendationInput,
  ExplainRecommendationResult
> {
  constructor(
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
    @Inject(LLM_PORT) private readonly gemini: LlmPort,
  ) {}

  async execute(
    input: ExplainRecommendationInput,
  ): Promise<ExplainRecommendationResult> {
    const rec = await this.recRepo.findById(input.recommendationId)
    if (!rec) {
      throw new Error(`Recommendation not found: ${input.recommendationId}`)
    }
    if (rec.explanation) {
      return { explanation: rec.explanation }
    }

    const [source, target] = await Promise.all([
      this.companyRepo.findById(rec.sourceCompanyId),
      this.companyRepo.findById(rec.targetCompanyId),
    ])
    if (!source || !target) {
      throw new Error(
        `Companies not found for recommendation ${input.recommendationId}`,
      )
    }

    const prompt = buildPrompt(rec, source, target)
    const explanation = await this.gemini.generateText(prompt)
    await this.recRepo.updateExplanation(rec.id, explanation)
    return { explanation }
  }
}

function buildPrompt(
  rec: Recommendation,
  source: Company,
  target: Company,
): string {
  const glossary = RELATION_GLOSSARY[rec.relationType]
  const rules = findRulesForPair(source.ciiu, target.ciiu)
  const sourceEcos = findEcosystemsContaining(source.ciiu)
  const targetEcos = findEcosystemsContaining(target.ciiu)
  const sharedEcos = sourceEcos.filter((s) =>
    targetEcos.some((t) => t.id === s.id),
  )

  const reasonsBlock = formatReasons(rec.reasons.toJson())
  const rulesBlock = formatRules(rules)
  const ecosystemsBlock = formatEcosystems(sharedEcos)
  const confidence = Math.round(rec.score * 100)

  return `Sos un asesor empresarial colombiano experto en el tejido empresarial del Magdalena. Tu objetivo es ayudar al empresario a entender por qué TIENE SENTIDO conectarse con la otra empresa y qué hacer al respecto.

EMPRESA A ASESORAR (source):
- Razón social: "${source.razonSocial}"
- CIIU ${source.ciiu}
- Municipio: ${source.municipio}
- Etapa empresarial: ${source.etapa}
- Personal: ${source.personal} colaboradores
- Ingreso operacional anual: ${formatMoney(source.ingresoOperacion)}

EMPRESA SUGERIDA (target):
- Razón social: "${target.razonSocial}"
- CIIU ${target.ciiu}
- Municipio: ${target.municipio}
- Etapa empresarial: ${target.etapa}
- Personal: ${target.personal} colaboradores
- Ingreso operacional anual: ${formatMoney(target.ingresoOperacion)}

TIPO DE RELACIÓN SUGERIDA: ${rec.relationType.toUpperCase()} — ${glossary.label}
DEFINICIÓN EMPRESARIAL: ${glossary.definition}

REGLAS DE CADENA DE VALOR APLICABLES AL PAR:
${rulesBlock}

ECOSISTEMAS ECONÓMICOS COMPARTIDOS:
${ecosystemsBlock}

EVIDENCIAS DETECTADAS POR EL MOTOR DE RECOMENDACIONES:
${reasonsBlock}

NIVEL DE CONFIANZA DEL MATCH: ${confidence}/100

Tarea: explicale a "${source.razonSocial}" en 3-4 frases POR QUÉ tiene sentido conectarse con "${target.razonSocial}" en este rol específico de ${rec.relationType}, citando la cadena de valor o el ecosistema concreto que los une (no inventes datos: usá solo lo que aparece arriba). Cerrá con UN siguiente paso accionable y concreto que el empresario debería dar la próxima semana (ej. visitar la planta, mandar un correo de presentación, invitar a un café, pedir una referencia gremial).

Tono: profesional pero cercano, español neutro colombiano. Texto corrido, sin bullets, sin emojis.`
}

function formatReasons(
  reasons: {
    feature: ReasonFeature
    weight: number
    value?: string | number
    description: string
  }[],
): string {
  if (reasons.length === 0) return '(sin evidencias estructuradas)'
  return reasons
    .map((r) => {
      const label = FEATURE_LABELS[r.feature]
      const value = r.value !== undefined ? ` (${r.value})` : ''
      return `- ${label}${value}: ${r.description}`
    })
    .join('\n')
}

function formatRules(rules: ValueChainRule[]): string {
  if (rules.length === 0) {
    return '(ninguna regla específica de cadena de valor para este par)'
  }
  return rules
    .map(
      (r) =>
        `- ${r.description} (peso ${r.weight}, ${r.ciiuOrigen} → ${r.ciiuDestino})`,
    )
    .join('\n')
}

function formatEcosystems(ecos: Ecosystem[]): string {
  if (ecos.length === 0) {
    return '(no comparten ecosistema económico definido)'
  }
  return ecos.map((e) => `- ${e.name}: ${e.description}`).join('\n')
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString('es-CO')} COP`
}
