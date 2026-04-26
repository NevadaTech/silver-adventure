import { describe, expect, it } from 'vitest'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { RecommendationLimiter } from '@/recommendations/application/services/RecommendationLimiter'
import type { RecommendationSource } from '@/recommendations/domain/entities/Recommendation'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'

let counter = 0

const rec = (
  overrides: Partial<{
    sourceCompanyId: string
    targetCompanyId: string
    relationType: RelationType
    score: number
    source: RecommendationSource
  }> = {},
): Recommendation =>
  Recommendation.create({
    id: `rec-${++counter}`,
    sourceCompanyId: overrides.sourceCompanyId ?? 'src',
    targetCompanyId: overrides.targetCompanyId ?? `tgt-${counter}`,
    relationType: overrides.relationType ?? 'cliente',
    score: overrides.score ?? 0.5,
    reasons: Reasons.empty(),
    source: overrides.source ?? 'rule',
  })

describe('RecommendationLimiter', () => {
  describe('dedupeByTargetAndType', () => {
    it('keeps the max-score rec when multiple recs share (target, type)', () => {
      const limiter = new RecommendationLimiter()
      const a = rec({
        targetCompanyId: 't1',
        relationType: 'cliente',
        score: 0.4,
      })
      const b = rec({
        targetCompanyId: 't1',
        relationType: 'cliente',
        score: 0.9,
      })
      const c = rec({
        targetCompanyId: 't1',
        relationType: 'cliente',
        score: 0.6,
      })

      const out = limiter.dedupeByTargetAndType([a, b, c])

      expect(out).toHaveLength(1)
      expect(out[0].id).toBe(b.id)
    })

    it('keeps separate recs for the same target with different types', () => {
      const limiter = new RecommendationLimiter()
      const cliente = rec({ targetCompanyId: 't1', relationType: 'cliente' })
      const aliado = rec({ targetCompanyId: 't1', relationType: 'aliado' })

      const out = limiter.dedupeByTargetAndType([cliente, aliado])
      expect(out).toHaveLength(2)
    })
  })

  describe('capPerType', () => {
    it('caps recommendations to N per relationType keeping highest scores', () => {
      const limiter = new RecommendationLimiter()
      const recs = [
        rec({ relationType: 'cliente', score: 0.9 }),
        rec({ relationType: 'cliente', score: 0.8 }),
        rec({ relationType: 'cliente', score: 0.7 }),
        rec({ relationType: 'cliente', score: 0.6 }),
      ]

      const out = limiter.capPerType(recs, 2)
      expect(out).toHaveLength(2)
      expect(out.map((r) => r.score)).toEqual([0.9, 0.8])
    })

    it('caps each relationType independently', () => {
      const limiter = new RecommendationLimiter()
      const recs = [
        rec({ relationType: 'cliente', score: 0.9 }),
        rec({ relationType: 'cliente', score: 0.8 }),
        rec({ relationType: 'cliente', score: 0.7 }),
        rec({ relationType: 'aliado', score: 0.5 }),
        rec({ relationType: 'aliado', score: 0.4 }),
        rec({ relationType: 'aliado', score: 0.3 }),
        rec({ relationType: 'referente', score: 0.2 }),
      ]

      const out = limiter.capPerType(recs, 2)
      const counts = countByType(out)
      expect(counts.get('cliente')).toBe(2)
      expect(counts.get('aliado')).toBe(2)
      expect(counts.get('referente')).toBe(1)
    })

    it('returns at most 4 * perType recs given the 4 relationTypes', () => {
      const limiter = new RecommendationLimiter()
      const recs = Array.from({ length: 50 }, (_, i) =>
        rec({
          relationType: (
            ['cliente', 'proveedor', 'referente', 'aliado'] as const
          )[i % 4],
          score: Math.random(),
        }),
      )

      const out = limiter.capPerType(recs, 2)
      expect(out.length).toBeLessThanOrEqual(8)
    })
  })
})

function countByType(recs: Recommendation[]): Map<RelationType, number> {
  const out = new Map<RelationType, number>()
  for (const r of recs) {
    out.set(r.relationType, (out.get(r.relationType) ?? 0) + 1)
  }
  return out
}
