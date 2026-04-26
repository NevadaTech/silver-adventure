import { Injectable } from '@nestjs/common'
import {
  GetCompanyRecommendations,
  type RecommendationView,
} from '@/recommendations/application/use-cases/GetCompanyRecommendations'
import {
  RELATION_TYPES,
  type RelationType,
} from '@/recommendations/domain/value-objects/RelationType'
import type { UseCase } from '@/shared/domain/UseCase'

export interface GetGroupedCompanyRecommendationsInput {
  companyId: string
}

export type GroupedRecommendations = Record<RelationType, RecommendationView[]>

export interface GetGroupedCompanyRecommendationsResult extends GroupedRecommendations {
  partial: boolean
}

const PER_TYPE_LIMIT = 10
const PER_TYPE_MIN = 3

@Injectable()
export class GetGroupedCompanyRecommendations implements UseCase<
  GetGroupedCompanyRecommendationsInput,
  GetGroupedCompanyRecommendationsResult
> {
  constructor(private readonly getRecommendations: GetCompanyRecommendations) {}

  async execute(
    input: GetGroupedCompanyRecommendationsInput,
  ): Promise<GetGroupedCompanyRecommendationsResult> {
    const entries = await Promise.all(
      RELATION_TYPES.map(async (type) => {
        const result = await this.getRecommendations.execute({
          companyId: input.companyId,
          type,
          limit: PER_TYPE_LIMIT,
        })
        return [type, result.recommendations] as const
      }),
    )

    const grouped: GroupedRecommendations = {
      proveedor: [],
      cliente: [],
      aliado: [],
      referente: [],
    }
    for (const [type, recs] of entries) {
      grouped[type] = recs
    }

    const partial = RELATION_TYPES.some(
      (type) => grouped[type].length < PER_TYPE_MIN,
    )

    return { ...grouped, partial }
  }
}
