import { Injectable } from '@nestjs/common'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import type { RecommendationRepository } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

@Injectable()
export class InMemoryRecommendationRepository implements RecommendationRepository {
  private readonly store = new Map<string, Recommendation>()

  async saveAll(recs: Recommendation[]): Promise<void> {
    for (const r of recs) {
      this.store.set(r.id, r)
    }
  }

  async findById(id: string): Promise<Recommendation | null> {
    return this.store.get(id) ?? null
  }

  async findBySource(
    sourceId: string,
    limit?: number,
  ): Promise<Recommendation[]> {
    const matched = Array.from(this.store.values())
      .filter((r) => r.sourceCompanyId === sourceId)
      .sort((a, b) => b.score - a.score)
    return limit !== undefined ? matched.slice(0, limit) : matched
  }

  async findBySourceAndType(
    sourceId: string,
    type: RelationType,
    limit?: number,
  ): Promise<Recommendation[]> {
    const matched = Array.from(this.store.values())
      .filter((r) => r.sourceCompanyId === sourceId && r.relationType === type)
      .sort((a, b) => b.score - a.score)
    return limit !== undefined ? matched.slice(0, limit) : matched
  }

  async updateExplanation(id: string, explanation: string): Promise<void> {
    const existing = this.store.get(id)
    if (!existing) return
    this.store.set(id, existing.withExplanation(explanation, new Date()))
  }

  async countBySource(sourceId: string): Promise<number> {
    let n = 0
    for (const r of this.store.values()) {
      if (r.sourceCompanyId === sourceId) n++
    }
    return n
  }

  async deleteAll(): Promise<void> {
    this.store.clear()
  }
}
