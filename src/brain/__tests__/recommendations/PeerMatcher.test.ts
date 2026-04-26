import { describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { FeatureVectorBuilder } from '@/recommendations/application/services/FeatureVectorBuilder'
import { PeerMatcher } from '@/recommendations/application/services/PeerMatcher'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c1',
    razonSocial: 'Acme',
    ciiu: 'C1071',
    municipio: 'SANTA MARTA',
    personal: 5,
    ingresoOperacion: 50_000_000,
    fechaMatricula: new Date('2022-01-01'),
    ...overrides,
  })

describe('PeerMatcher', () => {
  const matcher = new PeerMatcher(new FeatureVectorBuilder())

  it('recommends peers from the same ciiu division', () => {
    const sm1 = company({ id: 'sm1', municipio: 'SANTA MARTA', ciiu: 'C1071' })
    const sm2 = company({ id: 'sm2', municipio: 'SANTA MARTA', ciiu: 'C1071' })
    const sm3 = company({ id: 'sm3', municipio: 'SANTA MARTA', ciiu: 'C1071' })
    const cienaga1 = company({
      id: 'ci1',
      municipio: 'CIENAGA',
      ciiu: 'C1071',
    })
    const cienaga2 = company({
      id: 'ci2',
      municipio: 'CIENAGA',
      ciiu: 'C1071',
    })
    const hotel = company({
      id: 'hotel',
      municipio: 'SANTA MARTA',
      ciiu: 'I5511',
    })

    const result = matcher.match([sm1, sm2, sm3, cienaga1, cienaga2, hotel])

    const sm1Recs = result.get('sm1') ?? []
    expect(sm1Recs.length).toBeGreaterThan(0)
    const targetIds = sm1Recs.map((r) => r.targetCompanyId)
    expect(targetIds).toContain('sm2')
    expect(targetIds).toContain('sm3')
    expect(targetIds).not.toContain('hotel')
  })

  it('marks every recommendation as referente from cosine source', () => {
    const a = company({ id: 'a', ciiu: 'C1071' })
    const b = company({ id: 'b', ciiu: 'C1071' })
    const result = matcher.match([a, b])

    const aRecs = result.get('a')!
    expect(aRecs[0].relationType).toBe('referente')
    expect(aRecs[0].source).toBe('cosine')
  })

  it('orders peers by proximity (same municipio first)', () => {
    const src = company({
      id: 'src',
      municipio: 'SANTA MARTA',
      ciiu: 'C1071',
    })
    const near = company({
      id: 'near',
      municipio: 'SANTA MARTA',
      ciiu: 'C1071',
    })
    const far = company({ id: 'far', municipio: 'CIENAGA', ciiu: 'C1071' })

    const result = matcher.match([src, near, far])
    const ids = result.get('src')!.map((r) => r.targetCompanyId)
    expect(ids[0]).toBe('near')
    expect(ids[1]).toBe('far')
  })

  it('attaches structured reasons reflecting shared ciiu and municipio', () => {
    const a = company({ id: 'a', ciiu: 'C1071', municipio: 'SANTA MARTA' })
    const b = company({ id: 'b', ciiu: 'C1071', municipio: 'SANTA MARTA' })

    const result = matcher.match([a, b])
    const reasons = result.get('a')![0].reasons.toJson()
    const features = reasons.map((r) => r.feature)
    expect(features).toContain('mismo_ciiu_clase')
    expect(features).toContain('mismo_municipio')
  })

  it('returns empty for a company with no peers in its division', () => {
    const lonely = company({ id: 'lonely', ciiu: 'I5511' })
    const a = company({ id: 'a', ciiu: 'C1071' })
    const result = matcher.match([lonely, a])
    expect(result.get('lonely') ?? []).toEqual([])
  })

  it('respects topN per company', () => {
    const peers = Array.from({ length: 8 }, (_, i) =>
      company({ id: `p${i}`, ciiu: 'C1071' }),
    )
    const result = matcher.match(peers, { topN: 3 })
    expect(result.get('p0')!.length).toBe(3)
  })

  it('produces scores in 0..1', () => {
    const a = company({ id: 'a', ciiu: 'C1071' })
    const b = company({ id: 'b', ciiu: 'C1071' })
    const result = matcher.match([a, b])
    for (const rec of result.get('a')!) {
      expect(rec.score).toBeGreaterThan(0)
      expect(rec.score).toBeLessThanOrEqual(1)
    }
  })
})
