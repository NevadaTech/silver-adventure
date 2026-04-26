import { Injectable } from '@nestjs/common'
import type { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

@Injectable()
export class RecommendationLimiter {
  dedupeByTargetAndType(recs: Recommendation[]): Recommendation[] {
    const byKey = new Map<string, Recommendation>()
    for (const rec of recs) {
      const key = `${rec.targetCompanyId}|${rec.relationType}`
      const existing = byKey.get(key)
      if (!existing || rec.score > existing.score) {
        byKey.set(key, rec)
      }
    }
    return Array.from(byKey.values())
  }

  capPerType(recs: Recommendation[], perType: number): Recommendation[] {
    const sorted = [...recs].sort((a, b) => b.score - a.score)
    const counts = new Map<RelationType, number>()
    const out: Recommendation[] = []
    for (const rec of sorted) {
      const c = counts.get(rec.relationType) ?? 0
      if (c < perType) {
        out.push(rec)
        counts.set(rec.relationType, c + 1)
      }
    }
    return out
  }
}
