import { Inject, Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'
import {
  CIIU_TAXONOMY_REPOSITORY,
  type CiiuTaxonomyRepository,
} from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import { GEMINI_PORT } from '@/shared/shared.module'
import type { GeminiPort } from '@/shared/domain/GeminiPort'
import type { UseCase } from '@/shared/domain/UseCase'

export interface ClassifyCompanyFromDescriptionInput {
  description: string
  businessName: string
  municipio: string
}

export interface ClassifiedCiiu {
  code: string
  titulo: string
  seccion: string
  division: string
  grupo: string
  macroSector: string | null
}

export interface ClassifyCompanyFromDescriptionResult {
  ciiu: ClassifiedCiiu
  reasoning: string
}

const responseSchema = z.object({
  ciiuCode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'ciiuCode must be a 4-digit string'),
  reasoning: z.string().trim().min(1),
})

@Injectable()
export class ClassifyCompanyFromDescription implements UseCase<
  ClassifyCompanyFromDescriptionInput,
  ClassifyCompanyFromDescriptionResult
> {
  private readonly logger = new Logger(ClassifyCompanyFromDescription.name)

  constructor(
    @Inject(GEMINI_PORT) private readonly gemini: GeminiPort,
    @Inject(CIIU_TAXONOMY_REPOSITORY)
    private readonly taxonomy: CiiuTaxonomyRepository,
  ) {}

  async execute(
    input: ClassifyCompanyFromDescriptionInput,
  ): Promise<ClassifyCompanyFromDescriptionResult> {
    const description = input.description.trim()
    if (description.length === 0) {
      throw new Error('description cannot be empty')
    }

    const businessName = input.businessName.trim()
    const municipio = input.municipio.trim()

    const firstPrompt = buildPrompt({
      description,
      businessName,
      municipio,
    })
    const first = await this.callGemini(firstPrompt)
    const firstActivity = await this.taxonomy.findByCode(first.ciiuCode)
    if (firstActivity) {
      return toResult(firstActivity, first.reasoning)
    }

    this.logger.warn(
      `Gemini returned unknown CIIU '${first.ciiuCode}' — retrying once`,
    )
    const retryPrompt = buildPrompt({
      description,
      businessName,
      municipio,
      previousInvalidCode: first.ciiuCode,
    })
    const retry = await this.callGemini(retryPrompt)
    const retryActivity = await this.taxonomy.findByCode(retry.ciiuCode)
    if (!retryActivity) {
      throw new Error(
        `Could not classify business: Gemini returned invalid CIIU codes (${first.ciiuCode}, ${retry.ciiuCode})`,
      )
    }
    return toResult(retryActivity, retry.reasoning)
  }

  private async callGemini(
    prompt: string,
  ): Promise<z.infer<typeof responseSchema>> {
    return this.gemini.inferStructured(prompt, (raw) =>
      responseSchema.parse(raw),
    )
  }
}

function toResult(
  activity: {
    code: string
    titulo: string
    seccion: string
    division: string
    grupo: string
    macroSector: string | null
  },
  reasoning: string,
): ClassifyCompanyFromDescriptionResult {
  return {
    ciiu: {
      code: activity.code,
      titulo: activity.titulo,
      seccion: activity.seccion,
      division: activity.division,
      grupo: activity.grupo,
      macroSector: activity.macroSector,
    },
    reasoning,
  }
}

interface PromptParams {
  description: string
  businessName: string
  municipio: string
  previousInvalidCode?: string
}

function buildPrompt(params: PromptParams): string {
  const retryNote = params.previousInvalidCode
    ? `\nIMPORTANTE: el código '${params.previousInvalidCode}' que sugeriste antes NO existe en la taxonomía CIIU 4 dígitos del DANE. Volvé a clasificar con un código válido distinto.`
    : ''

  return `Sos un experto en clasificación CIIU (Clasificación Industrial Internacional Uniforme) versión 4 adaptada por el DANE de Colombia.
Tu tarea: dado el negocio descrito abajo, devolver el CÓDIGO CIIU de 4 dígitos que mejor lo representa.

Negocio: "${params.businessName}"
Municipio: ${params.municipio}
Descripción: ${params.description}${retryNote}

Reglas:
- Devolvé SOLO un objeto JSON válido, sin markdown ni texto extra.
- "ciiuCode": exactamente 4 dígitos (sin la letra de sección).
- "reasoning": una frase breve en español explicando por qué ese código encaja, basada en la descripción.

Formato de respuesta (JSON):
{
  "ciiuCode": "5611",
  "reasoning": "..."
}`
}
