import { beforeEach, describe, expect, it } from 'vitest'
import { ExplainCluster } from '@/clusters/application/use-cases/ExplainCluster'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { StubLlmAdapter } from '@/shared/infrastructure/llm/StubLlmAdapter'

function makeCompany(id: string, razonSocial = 'X SAS'): Company {
  return Company.create({
    id,
    razonSocial,
    ciiu: 'G4711',
    municipio: 'SANTA MARTA',
  })
}

describe('ExplainCluster', () => {
  let clusterRepo: InMemoryClusterRepository
  let membershipRepo: InMemoryClusterMembershipRepository
  let companyRepo: InMemoryCompanyRepository
  let gemini: StubLlmAdapter
  let useCase: ExplainCluster

  beforeEach(() => {
    clusterRepo = new InMemoryClusterRepository()
    membershipRepo = new InMemoryClusterMembershipRepository()
    companyRepo = new InMemoryCompanyRepository()
    gemini = new StubLlmAdapter('AI generated description')
    useCase = new ExplainCluster(
      clusterRepo,
      membershipRepo,
      companyRepo,
      gemini,
    )
  })

  it('returns cached descripcion without calling Gemini when present', async () => {
    let calls = 0
    const trackingGemini = {
      generateText: async () => {
        calls++
        return 'should not be called'
      },
      inferStructured: async () => ({}) as never,
    }
    useCase = new ExplainCluster(
      clusterRepo,
      membershipRepo,
      companyRepo,
      trackingGemini,
    )
    await clusterRepo.saveMany([
      Cluster.create({
        id: 'pred-1',
        codigo: 'C1',
        titulo: 'C1',
        descripcion: 'cached desc',
        tipo: 'predefined',
      }),
    ])

    const { description } = await useCase.execute({ clusterId: 'pred-1' })

    expect(description).toBe('cached desc')
    expect(calls).toBe(0)
  })

  it('calls Gemini and persists descripcion when missing', async () => {
    await clusterRepo.saveMany([
      Cluster.create({
        id: 'div-47-X',
        codigo: '47-X',
        titulo: 'Comercio en X',
        descripcion: null,
        tipo: 'heuristic-division',
        ciiuDivision: '47',
        municipio: 'X',
        memberCount: 5,
      }),
    ])
    await companyRepo.saveMany([
      makeCompany('c-1', 'ACME SAS'),
      makeCompany('c-2', 'BETA SA'),
    ])
    await membershipRepo.saveMany([
      { clusterId: 'div-47-X', companyId: 'c-1' },
      { clusterId: 'div-47-X', companyId: 'c-2' },
    ])

    const { description } = await useCase.execute({ clusterId: 'div-47-X' })

    expect(description).toBe('AI generated description')
    const updated = await clusterRepo.findById('div-47-X')
    expect(updated!.descripcion).toBe('AI generated description')
  })

  it('builds the prompt with cluster + sample companies', async () => {
    let captured = ''
    const capturingGemini = {
      generateText: async (p: string) => {
        captured = p
        return 'desc'
      },
      inferStructured: async () => ({}) as never,
    }
    useCase = new ExplainCluster(
      clusterRepo,
      membershipRepo,
      companyRepo,
      capturingGemini,
    )
    await clusterRepo.saveMany([
      Cluster.create({
        id: 'div-47-X',
        codigo: '47-X',
        titulo: 'Comercio en X',
        descripcion: null,
        tipo: 'heuristic-division',
        ciiuDivision: '47',
        municipio: 'BARRANQUILLA',
        memberCount: 2,
      }),
    ])
    await companyRepo.saveMany([makeCompany('c-1', 'ACME SAS')])
    await membershipRepo.saveMany([{ clusterId: 'div-47-X', companyId: 'c-1' }])

    await useCase.execute({ clusterId: 'div-47-X' })

    expect(captured).toContain('Comercio en X')
    expect(captured).toContain('heuristic-division')
    expect(captured).toContain('BARRANQUILLA')
    expect(captured).toContain('ACME SAS')
  })

  it('throws when cluster does not exist', async () => {
    await expect(useCase.execute({ clusterId: 'missing' })).rejects.toThrow(
      /missing/,
    )
  })
})
