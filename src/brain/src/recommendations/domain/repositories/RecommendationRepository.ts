import type { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

export const RECOMMENDATION_REPOSITORY = Symbol('RECOMMENDATION_REPOSITORY')

export interface RecommendationRepository {
  saveAll(recs: Recommendation[]): Promise<void>
  findById(id: string): Promise<Recommendation | null>
  findBySource(sourceId: string, limit?: number): Promise<Recommendation[]>
  findBySourceAndType(
    sourceId: string,
    type: RelationType,
    limit?: number,
  ): Promise<Recommendation[]>
  updateExplanation(id: string, explanation: string): Promise<void>
  countBySource(sourceId: string): Promise<number>
  deleteAll(): Promise<void>
}
