import { describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { AiCacheExpander } from '@/recommendations/application/services/AiCacheExpander'
import { FeatureVectorBuilder } from '@/recommendations/application/services/FeatureVectorBuilder'
import { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'
import { InMemoryAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c',
    razonSocial: 'Acme',
    ciiu: 'A0122',
    municipio: 'SANTA MARTA',
    fechaMatricula: new Date('2022-01-01'),
    personal: 5,
    ingresoOperacion: 50_000_000,
    ...overrides,
  })

function makeExpander() {
  const cache = new InMemoryAiMatchCacheRepository()
  const featureBuilder = new FeatureVectorBuilder()
  const expander = new AiCacheExpander(cache, featureBuilder)
  return { cache, featureBuilder, expander }
}

describe('AiCacheExpander', () => {
  describe('expandForCompany', () => {
    it('returns recs for cache hits between source and the universe', async () => {
      const { cache, expander } = makeExpander()
      await cache.put(
        AiMatchCacheEntry.create({
          ciiuOrigen: '0122',
          ciiuDestino: '4631',
          hasMatch: true,
          relationType: 'cliente',
          confidence: 0.85,
          reason: 'Banano vende a mayoristas',
        }),
      )
      const banano = company({ id: 'banano', ciiu: 'A0122' })
      const mayor = company({ id: 'mayor', ciiu: 'G4631' })

      const recs = await expander.expandForCompany(banano, [banano, mayor])

      expect(recs).toHaveLength(1)
      expect(recs[0].sourceCompanyId).toBe('banano')
      expect(recs[0].targetCompanyId).toBe('mayor')
      expect(recs[0].relationType).toBe('cliente')
      expect(recs[0].source).toBe('ai-inferred')
    })

    it('skips entries with hasMatch=false', async () => {
      const { cache, expander } = makeExpander()
      await cache.put(
        AiMatchCacheEntry.create({
          ciiuOrigen: '0122',
          ciiuDestino: '4631',
          hasMatch: false,
        }),
      )
      const banano = company({ id: 'banano', ciiu: 'A0122' })
      const mayor = company({ id: 'mayor', ciiu: 'G4631' })

      const recs = await expander.expandForCompany(banano, [banano, mayor])
      expect(recs).toHaveLength(0)
    })

    it('skips entries with confidence below the min threshold (0.5)', async () => {
      const { cache, expander } = makeExpander()
      await cache.put(
        AiMatchCacheEntry.create({
          ciiuOrigen: '0122',
          ciiuDestino: '4631',
          hasMatch: true,
          relationType: 'cliente',
          confidence: 0.3,
          reason: 'low confidence',
        }),
      )
      const banano = company({ id: 'banano', ciiu: 'A0122' })
      const mayor = company({ id: 'mayor', ciiu: 'G4631' })

      const recs = await expander.expandForCompany(banano, [banano, mayor])
      expect(recs).toHaveLength(0)
    })

    it('inverts the relationType when source.ciiu > target.ciiu (cache stored canonically)', async () => {
      const { cache, expander } = makeExpander()
      await cache.put(
        AiMatchCacheEntry.create({
          ciiuOrigen: '0122',
          ciiuDestino: '4631',
          hasMatch: true,
          relationType: 'cliente',
          confidence: 0.85,
          reason: 'Banano vende a mayoristas',
        }),
      )
      const banano = company({ id: 'banano', ciiu: 'A0122' })
      const mayor = company({ id: 'mayor', ciiu: 'G4631' })

      const recsForMayor = await expander.expandForCompany(mayor, [
        banano,
        mayor,
      ])

      expect(recsForMayor).toHaveLength(1)
      expect(recsForMayor[0].sourceCompanyId).toBe('mayor')
      expect(recsForMayor[0].targetCompanyId).toBe('banano')
      expect(recsForMayor[0].relationType).toBe('proveedor')
    })

    it('does not return self-recommendations', async () => {
      const { cache, expander } = makeExpander()
      await cache.put(
        AiMatchCacheEntry.create({
          ciiuOrigen: '0122',
          ciiuDestino: '0122',
          hasMatch: true,
          relationType: 'referente',
          confidence: 0.9,
        }),
      )
      const banano = company({ id: 'banano', ciiu: 'A0122' })

      const recs = await expander.expandForCompany(banano, [banano])
      expect(recs).toHaveLength(0)
    })

    it('adds mismo_municipio reason when source and target share municipio', async () => {
      const { cache, expander } = makeExpander()
      await cache.put(
        AiMatchCacheEntry.create({
          ciiuOrigen: '0122',
          ciiuDestino: '4631',
          hasMatch: true,
          relationType: 'cliente',
          confidence: 0.85,
          reason: 'Banano vende a mayoristas',
        }),
      )
      const banano = company({
        id: 'banano',
        ciiu: 'A0122',
        municipio: 'SANTA MARTA',
      })
      const mayor = company({
        id: 'mayor',
        ciiu: 'G4631',
        municipio: 'SANTA MARTA',
      })

      const recs = await expander.expandForCompany(banano, [banano, mayor])
      const features = recs[0].reasons.toJson().map((r) => r.feature)

      expect(features).toContain('ai_inferido')
      expect(features).toContain('mismo_municipio')
    })
  })

  describe('expandForAll', () => {
    it('returns a Map keyed by source company id with cache-driven recs', async () => {
      const { cache, expander } = makeExpander()
      await cache.put(
        AiMatchCacheEntry.create({
          ciiuOrigen: '0122',
          ciiuDestino: '4631',
          hasMatch: true,
          relationType: 'cliente',
          confidence: 0.85,
          reason: 'r',
        }),
      )
      const banano = company({ id: 'banano', ciiu: 'A0122' })
      const mayor = company({ id: 'mayor', ciiu: 'G4631' })

      const out = await expander.expandForAll([banano, mayor])

      expect(out.get('banano')?.length).toBe(1)
      expect(out.get('mayor')?.length).toBe(1)
      expect(out.get('banano')?.[0].relationType).toBe('cliente')
      expect(out.get('mayor')?.[0].relationType).toBe('proveedor')
    })
  })
})
