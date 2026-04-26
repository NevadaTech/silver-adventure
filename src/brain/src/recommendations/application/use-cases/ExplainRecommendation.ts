import { Inject, Injectable } from '@nestjs/common'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { RECOMMENDATION_REPOSITORY } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RecommendationRepository } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { LlmPort } from '@/shared/domain/LlmPort'
import type { UseCase } from '@/shared/domain/UseCase'
import { LLM_PORT } from '@/shared/shared.module'

export interface ExplainRecommendationInput {
  recommendationId: string
}

export interface ExplainRecommendationResult {
  explanation: string
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

    const prompt = `Sos un asesor empresarial colombiano. Explicá en 2-3 frases por qué la empresa "${source.razonSocial}" (CIIU ${source.ciiu}, ${source.municipio}) podría conectarse con "${target.razonSocial}" (CIIU ${target.ciiu}, ${target.municipio}) como ${rec.relationType}.

Razones estructuradas detectadas: ${JSON.stringify(rec.reasons.toJson())}

Tono: profesional pero cercano, en español rioplatense neutro. Termina con un siguiente paso concreto que el empresario debería hacer.`

    const explanation = await this.gemini.generateText(prompt)
    await this.recRepo.updateExplanation(rec.id, explanation)
    return { explanation }
  }
}
