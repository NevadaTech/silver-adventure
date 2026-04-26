import { describe, expect, it } from 'vitest'
import {
  Recommendation,
  type CreateRecommendationInput,
  type RecommendationSource,
} from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'

const validInput = (
  overrides: Partial<CreateRecommendationInput> = {},
): CreateRecommendationInput => ({
  id: 'rec-1',
  sourceCompanyId: 'company-a',
  targetCompanyId: 'company-b',
  relationType: 'cliente',
  score: 0.8,
  reasons: Reasons.from([
    {
      feature: 'mismo_ciiu_clase',
      weight: 0.4,
      description: 'mismo ciiu',
    },
  ]),
  source: 'ai-inferred',
  ...overrides,
})

describe('Recommendation', () => {
  it('creates a recommendation with all required fields', () => {
    const rec = Recommendation.create(validInput())

    expect(rec.id).toBe('rec-1')
    expect(rec.sourceCompanyId).toBe('company-a')
    expect(rec.targetCompanyId).toBe('company-b')
    expect(rec.relationType).toBe('cliente')
    expect(rec.score).toBe(0.8)
    expect(rec.source).toBe<RecommendationSource>('ai-inferred')
    expect(rec.explanation).toBeNull()
    expect(rec.explanationCachedAt).toBeNull()
    expect(rec.reasons.toJson()).toHaveLength(1)
  })

  it('accepts optional explanation fields', () => {
    const cachedAt = new Date('2026-04-26T00:00:00Z')
    const rec = Recommendation.create(
      validInput({ explanation: 'porque sí', explanationCachedAt: cachedAt }),
    )

    expect(rec.explanation).toBe('porque sí')
    expect(rec.explanationCachedAt).toEqual(cachedAt)
  })

  it('rejects empty id', () => {
    expect(() => Recommendation.create(validInput({ id: '' }))).toThrow(
      'Recommendation.id cannot be empty',
    )
    expect(() => Recommendation.create(validInput({ id: '   ' }))).toThrow(
      'Recommendation.id cannot be empty',
    )
  })

  it('rejects empty source/target company ids', () => {
    expect(() =>
      Recommendation.create(validInput({ sourceCompanyId: '' })),
    ).toThrow('Recommendation.sourceCompanyId cannot be empty')
    expect(() =>
      Recommendation.create(validInput({ targetCompanyId: '' })),
    ).toThrow('Recommendation.targetCompanyId cannot be empty')
  })

  it('rejects self-recommendations', () => {
    expect(() =>
      Recommendation.create(
        validInput({ sourceCompanyId: 'same', targetCompanyId: 'same' }),
      ),
    ).toThrow('Cannot recommend a company to itself')
  })

  it('rejects scores outside 0..1', () => {
    expect(() => Recommendation.create(validInput({ score: -0.01 }))).toThrow(
      'Recommendation.score must be between 0 and 1',
    )
    expect(() => Recommendation.create(validInput({ score: 1.5 }))).toThrow(
      'Recommendation.score must be between 0 and 1',
    )
  })

  it('accepts boundary scores 0 and 1', () => {
    expect(() => Recommendation.create(validInput({ score: 0 }))).not.toThrow()
    expect(() => Recommendation.create(validInput({ score: 1 }))).not.toThrow()
  })

  it('accepts every recommendation source', () => {
    const sources: RecommendationSource[] = [
      'rule',
      'cosine',
      'ecosystem',
      'ai-inferred',
    ]
    for (const source of sources) {
      const rec = Recommendation.create(validInput({ source }))
      expect(rec.source).toBe(source)
    }
  })

  it('accepts every relation type', () => {
    for (const relationType of [
      'referente',
      'cliente',
      'proveedor',
      'aliado',
    ] as const) {
      const rec = Recommendation.create(validInput({ relationType }))
      expect(rec.relationType).toBe(relationType)
    }
  })

  it('exposes reasons as a Reasons collection', () => {
    const reasons = Reasons.from([
      { feature: 'mismo_municipio', weight: 0.3, description: 'misma ciudad' },
      { feature: 'misma_etapa', weight: 0.2, description: 'misma etapa' },
    ])
    const rec = Recommendation.create(validInput({ reasons }))

    expect(rec.reasons.toJson()).toHaveLength(2)
    expect(rec.reasons.totalWeight()).toBeCloseTo(0.5, 5)
  })

  it('returns true for equals when ids match', () => {
    const a = Recommendation.create(validInput({ id: 'rec-x' }))
    const b = Recommendation.create(
      validInput({ id: 'rec-x', sourceCompanyId: 'other' }),
    )
    expect(a.equals(b)).toBe(true)
  })

  it('returns false for equals when ids differ', () => {
    const a = Recommendation.create(validInput({ id: 'rec-1' }))
    const b = Recommendation.create(validInput({ id: 'rec-2' }))
    expect(a.equals(b)).toBe(false)
  })

  it('withExplanation returns a new instance with explanation populated', () => {
    const rec = Recommendation.create(validInput())
    const at = new Date('2026-04-26T01:00:00Z')
    const enriched = rec.withExplanation('detalle largo', at)

    expect(enriched).not.toBe(rec)
    expect(enriched.explanation).toBe('detalle largo')
    expect(enriched.explanationCachedAt).toEqual(at)
    expect(rec.explanation).toBeNull()
    expect(enriched.id).toBe(rec.id)
  })
})
