import type { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

export const RECOMMENDATION_REPOSITORY = Symbol('RECOMMENDATION_REPOSITORY')

export interface RecommendationRepository {
  saveAll(recs: Recommendation[]): Promise<void>
  findById(id: string): Promise<Recommendation | null>
  findAll(): Promise<Recommendation[]>
  findBySource(sourceId: string, limit?: number): Promise<Recommendation[]>
  findBySourceAndType(
    sourceId: string,
    type: RelationType,
    limit?: number,
  ): Promise<Recommendation[]>
  updateExplanation(id: string, explanation: string): Promise<void>
  countBySource(sourceId: string): Promise<number>
  deleteAll(): Promise<void>
  /**
   * Returns a Set of `${sourceCompanyId}|${targetCompanyId}|${relationType}`
   * keys for every stored recommendation. Used by the agent to diff scans.
   */
  snapshotKeys(): Promise<Set<string>>
}
