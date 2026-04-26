import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'
import { EcosystemDiscoverer } from '@/clusters/application/services/EcosystemDiscoverer'
import { Company } from '@/companies/domain/entities/Company'

function makeEdge(
  ciiuOrigen: string,
  ciiuDestino: string,
  confidence = 0.85,
): CiiuEdge {
  return CiiuEdge.create({
    ciiuOrigen,
    ciiuDestino,
    hasMatch: true,
    relationType: 'proveedor',
    confidence,
    modelVersion: null,
  })
}

function makeCompany(id: string, ciiu: string, municipio: string): Company {
  return Company.create({
    id,
    razonSocial: 'Test Company',
    ciiu: `G${ciiu}`,
    municipio,
  })
}

function makeLogger() {
  return {
    debug: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
  }
}

describe('EcosystemDiscoverer', () => {
  let graphRepo: InMemoryCiiuGraphRepository
  let logger: ReturnType<typeof makeLogger>
  let discoverer: EcosystemDiscoverer

  beforeEach(() => {
    graphRepo = new InMemoryCiiuGraphRepository()
    logger = makeLogger()
    discoverer = new EcosystemDiscoverer(graphRepo, logger as never)
  })

  it('returns empty array when graph is empty and logs warning', async () => {
    const companies = [makeCompany('c1', '5511', 'Santa Marta')]
    const results = await discoverer.discover(companies)
    expect(results).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('grafo vacío'),
    )
  })

  it('returns empty array when community is smaller than MIN_SIZE (3 CIIUs)', async () => {
    // Only 2 CIIUs in the community — below MIN_SIZE
    graphRepo.seed([makeEdge('5511', '9601')])
    const companies = [
      makeCompany('c1', '5511', 'Santa Marta'),
      makeCompany('c2', '9601', 'Santa Marta'),
    ]
    const results = await discoverer.discover(companies)
    expect(results).toEqual([])
  })

  it('returns a cluster when community has 3+ CIIUs and companies exist in a municipio', async () => {
    // Community: 5511-9601-5612 (3 CIIUs, passes MIN_SIZE)
    graphRepo.seed([makeEdge('5511', '9601'), makeEdge('9601', '5612')])
    const companies = [
      makeCompany('c1', '5511', 'Santa Marta'),
      makeCompany('c2', '5511', 'Santa Marta'),
      makeCompany('c3', '9601', 'Santa Marta'),
      makeCompany('c4', '5612', 'Santa Marta'),
      makeCompany('c5', '5511', 'Santa Marta'),
      makeCompany('c6', '9601', 'Santa Marta'),
      makeCompany('c7', '5612', 'Santa Marta'),
    ]
    const results = await discoverer.discover(companies)
    expect(results).toHaveLength(1)
    expect(results[0].cluster.tipo).toBe('heuristic-ecosistema')
    expect(results[0].cluster.municipio).toBe('Santa Marta')
    expect(results[0].members).toHaveLength(7)
  })

  it('splits community of 20 CIIUs into sub-communities of ≤15', async () => {
    // Create a chain of 20 CIIUs: C00-C01-C02-...-C19
    const ciius = Array.from({ length: 20 }, (_, i) =>
      String(i).padStart(2, '0').padEnd(4, '0'),
    )
    // Link them in a chain so they form 1 community
    const edges: CiiuEdge[] = []
    for (let i = 0; i < ciius.length - 1; i++) {
      edges.push(makeEdge(ciius[i], ciius[i + 1]))
    }
    graphRepo.seed(edges)

    // Provide companies for each CIIU
    const companies: Company[] = ciius.map((c, i) =>
      makeCompany(`comp-${i}`, c, 'Bogota'),
    )

    const results = await discoverer.discover(companies)
    // 20 CIIUs → 2 sub-communities of ≤15
    expect(results.length).toBeGreaterThanOrEqual(2)
    for (const r of results) {
      expect(r.members.length).toBeGreaterThan(0)
    }
  })

  it('generates separate clusters for the same CIIU community in different municipios', async () => {
    graphRepo.seed([makeEdge('5511', '9601'), makeEdge('9601', '5612')])
    const companies = [
      makeCompany('c1', '5511', 'Santa Marta'),
      makeCompany('c2', '9601', 'Santa Marta'),
      makeCompany('c3', '5612', 'Santa Marta'),
      makeCompany('c4', '5511', 'Barranquilla'),
      makeCompany('c5', '9601', 'Barranquilla'),
      makeCompany('c6', '5612', 'Barranquilla'),
    ]
    const results = await discoverer.discover(companies)
    expect(results).toHaveLength(2)
    const municipios = results.map((r) => r.cluster.municipio).sort()
    expect(municipios).toEqual(['Barranquilla', 'Santa Marta'])
  })

  it('generates stable IDs between two calls with same graph and companies', async () => {
    graphRepo.seed([makeEdge('5511', '9601'), makeEdge('9601', '5612')])
    const companies = [
      makeCompany('c1', '5511', 'Santa Marta'),
      makeCompany('c2', '9601', 'Santa Marta'),
      makeCompany('c3', '5612', 'Santa Marta'),
    ]
    const run1 = await discoverer.discover(companies)
    const run2 = await discoverer.discover(companies)
    expect(run1[0].cluster.id).toBe(run2[0].cluster.id)
  })

  it('does not include companies with CIIUs outside the detected community', async () => {
    graphRepo.seed([makeEdge('5511', '9601'), makeEdge('9601', '5612')])
    const companies = [
      makeCompany('c1', '5511', 'Santa Marta'),
      makeCompany('c2', '9601', 'Santa Marta'),
      makeCompany('c3', '5612', 'Santa Marta'),
      // Outside community:
      makeCompany('c4', '4711', 'Santa Marta'),
      makeCompany('c5', '9999', 'Santa Marta'),
    ]
    const results = await discoverer.discover(companies)
    expect(results).toHaveLength(1)
    // Only companies with CIIUs 5511, 9601, 5612 should be included
    const memberIds = results[0].members.map((m) => m.id).sort()
    expect(memberIds).toEqual(['c1', 'c2', 'c3'])
  })
})
