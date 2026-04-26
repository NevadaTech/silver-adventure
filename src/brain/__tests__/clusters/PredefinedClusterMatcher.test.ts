import { beforeEach, describe, expect, it } from 'vitest'
import { PredefinedClusterMatcher } from '@/clusters/application/services/PredefinedClusterMatcher'
import { InMemoryClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterCiiuMappingRepository'
import { Company } from '@/companies/domain/entities/Company'

function makeCompany(id: string, ciiu: string): Company {
  return Company.create({
    id,
    razonSocial: 'X',
    ciiu,
    municipio: 'SANTA MARTA',
  })
}

describe('PredefinedClusterMatcher', () => {
  let mappingRepo: InMemoryClusterCiiuMappingRepository
  let matcher: PredefinedClusterMatcher

  beforeEach(() => {
    mappingRepo = new InMemoryClusterCiiuMappingRepository()
    matcher = new PredefinedClusterMatcher(mappingRepo)
  })

  it('assigns companies to clusters whose CIIU matches', async () => {
    await mappingRepo.saveMany([
      { clusterId: 'pred-1', ciiuCode: '4711' },
      { clusterId: 'pred-2', ciiuCode: '4711' },
      { clusterId: 'pred-3', ciiuCode: '5611' },
    ])
    const companies = [
      makeCompany('a', 'G4711'),
      makeCompany('b', 'I5611'),
      makeCompany('c', 'G4711'),
    ]
    const result = await matcher.match(companies)
    const pred1 = result.get('pred-1')!
    expect(pred1.map((c) => c.id).sort()).toEqual(['a', 'c'])
    expect(
      result
        .get('pred-2')!
        .map((c) => c.id)
        .sort(),
    ).toEqual(['a', 'c'])
    expect(result.get('pred-3')!.map((c) => c.id)).toEqual(['b'])
  })

  it('a company in multiple predefined clusters appears in each', async () => {
    await mappingRepo.saveMany([
      { clusterId: 'pred-1', ciiuCode: '4711' },
      { clusterId: 'pred-2', ciiuCode: '4711' },
    ])
    const companies = [makeCompany('a', 'G4711')]
    const result = await matcher.match(companies)
    expect(result.get('pred-1')).toEqual(companies)
    expect(result.get('pred-2')).toEqual(companies)
  })

  it('skips companies whose CIIU has no mapping', async () => {
    await mappingRepo.saveMany([{ clusterId: 'pred-1', ciiuCode: '4711' }])
    const companies = [makeCompany('a', 'G4711'), makeCompany('b', 'H4921')]
    const result = await matcher.match(companies)
    expect(result.get('pred-1')!.map((c) => c.id)).toEqual(['a'])
    expect(result.size).toBe(1)
  })

  it('returns empty map when no mappings exist', async () => {
    const result = await matcher.match([makeCompany('a', 'G4711')])
    expect(result.size).toBe(0)
  })

  it('returns empty map for empty company list', async () => {
    await mappingRepo.saveMany([{ clusterId: 'pred-1', ciiuCode: '4711' }])
    expect((await matcher.match([])).size).toBe(0)
  })
})
