import { describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c1',
    razonSocial: 'Acme',
    ciiu: 'I5511',
    municipio: 'SANTA MARTA',
    ...overrides,
  })

describe('AllianceMatcher', () => {
  const matcher = new AllianceMatcher()

  it('pairs companies that share an ecosystem with relationType aliado from ecosystem source', () => {
    const hotel = company({ id: 'hotel', ciiu: 'I5511' })
    const transporte = company({ id: 'tr', ciiu: 'H4921' })
    const result = matcher.match([hotel, transporte])

    const hotelRecs = result.get('hotel') ?? []
    expect(hotelRecs.length).toBeGreaterThan(0)
    expect(hotelRecs[0].relationType).toBe('aliado')
    expect(hotelRecs[0].source).toBe('ecosystem')
    expect(hotelRecs[0].targetCompanyId).toBe('tr')
  })

  it('does not pair companies of the same ciiu (would be referente, not aliado)', () => {
    const hotel1 = company({ id: 'h1', ciiu: 'I5511' })
    const hotel2 = company({ id: 'h2', ciiu: 'I5511' })
    const result = matcher.match([hotel1, hotel2])

    expect(result.get('h1') ?? []).toEqual([])
  })

  it('boosts score when companies share municipio', () => {
    const hotel = company({
      id: 'hotel',
      ciiu: 'I5511',
      municipio: 'SANTA MARTA',
    })
    const trSm = company({
      id: 'trSm',
      ciiu: 'H4921',
      municipio: 'SANTA MARTA',
    })
    const trBog = company({ id: 'trBog', ciiu: 'H4921', municipio: 'BOGOTA' })

    const result = matcher.match([hotel, trSm, trBog])
    const recs = result.get('hotel') ?? []
    const sm = recs.find((r) => r.targetCompanyId === 'trSm')!
    const bog = recs.find((r) => r.targetCompanyId === 'trBog')!
    expect(sm.score).toBeGreaterThan(bog.score)
  })

  it('attaches an ecosistema_compartido reason carrying the ecosystem id', () => {
    const hotel = company({ id: 'hotel', ciiu: 'I5511' })
    const transporte = company({ id: 'tr', ciiu: 'H4921' })
    const result = matcher.match([hotel, transporte])

    const reasons = result.get('hotel')![0].reasons.toJson()
    expect(reasons[0].feature).toBe('ecosistema_compartido')
    expect(reasons[0].value).toBe('turismo')
  })

  it('emits both directions of the alliance', () => {
    const hotel = company({ id: 'hotel', ciiu: 'I5511' })
    const transporte = company({ id: 'tr', ciiu: 'H4921' })
    const result = matcher.match([hotel, transporte])

    const hotelTargets = (result.get('hotel') ?? []).map(
      (r) => r.targetCompanyId,
    )
    const trTargets = (result.get('tr') ?? []).map((r) => r.targetCompanyId)
    expect(hotelTargets).toContain('tr')
    expect(trTargets).toContain('hotel')
  })

  it('returns no recommendations when no two companies share an ecosystem', () => {
    const a = company({ id: 'a', ciiu: 'P8512' })
    const b = company({ id: 'b', ciiu: 'A0122' })
    const result = matcher.match([a, b])
    expect(result.get('a') ?? []).toEqual([])
    expect(result.get('b') ?? []).toEqual([])
  })

  it('produces unique recommendation ids', () => {
    const hotel = company({ id: 'hotel', ciiu: 'I5511' })
    const tr = company({ id: 'tr', ciiu: 'H4921' })
    const rest = company({ id: 'rest', ciiu: 'I5611' })
    const result = matcher.match([hotel, tr, rest])
    const ids = (result.get('hotel') ?? []).map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
