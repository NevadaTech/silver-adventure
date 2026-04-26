import { Inject, Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { RECOMMENDATION_REPOSITORY } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RecommendationRepository } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { Reason } from '@/recommendations/domain/value-objects/Reason'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'
import type { RecommendationSource } from '@/recommendations/domain/entities/Recommendation'
import type { UseCase } from '@/shared/domain/UseCase'

export interface GetCompanyRecommendationsInput {
  companyId: string
  type?: RelationType
  limit?: number
}

export interface RecommendationTargetView {
  id: string
  razonSocial: string
  ciiu: string
  ciiuSeccion: string
  ciiuDivision: string
  municipio: string
  etapa: string
  personal: number
  ingreso: number
}

export interface RecommendationView {
  id: string
  targetCompany: RecommendationTargetView | null
  relationType: RelationType
  score: number
  reasons: Reason[]
  source: RecommendationSource
  explanation: string | null
}

export interface GetCompanyRecommendationsResult {
  recommendations: RecommendationView[]
}

const DEFAULT_LIMIT = 10

@Injectable()
export class GetCompanyRecommendations implements UseCase<
  GetCompanyRecommendationsInput,
  GetCompanyRecommendationsResult
> {
  constructor(
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
  ) {}

  async execute(
    input: GetCompanyRecommendationsInput,
  ): Promise<GetCompanyRecommendationsResult> {
    const limit = input.limit ?? DEFAULT_LIMIT
    const recs = input.type
      ? await this.recRepo.findBySourceAndType(
          input.companyId,
          input.type,
          limit,
        )
      : await this.recRepo.findBySource(input.companyId, limit)

    const targetIds = Array.from(new Set(recs.map((r) => r.targetCompanyId)))
    const targets = await Promise.all(
      targetIds.map((id) => this.companyRepo.findById(id)),
    )
    const targetMap = new Map<string, Company>()
    for (const t of targets) {
      if (t) targetMap.set(t.id, t)
    }

    return {
      recommendations: recs.map((r) => ({
        id: r.id,
        targetCompany: targetMap.has(r.targetCompanyId)
          ? toTargetView(targetMap.get(r.targetCompanyId)!)
          : null,
        relationType: r.relationType,
        score: r.score,
        reasons: r.reasons.toJson(),
        source: r.source,
        explanation: r.explanation,
      })),
    }
  }
}

function toTargetView(c: Company): RecommendationTargetView {
  return {
    id: c.id,
    razonSocial: c.razonSocial,
    ciiu: c.ciiu,
    ciiuSeccion: c.ciiuSeccion,
    ciiuDivision: c.ciiuDivision,
    municipio: c.municipio,
    etapa: c.etapa,
    personal: c.personal,
    ingreso: c.ingresoOperacion,
  }
}
