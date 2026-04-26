import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpportunityDetector } from '@/agent/application/services/OpportunityDetector'
import { ScanRun } from '@/agent/domain/entities/ScanRun'
import { RunIncrementalScan } from '@/agent/application/use-cases/RunIncrementalScan'
import { InMemoryAgentEventRepository } from '@/agent/infrastructure/repositories/InMemoryAgentEventRepository'
import { InMemoryScanRunRepository } from '@/agent/infrastructure/repositories/InMemoryScanRunRepository'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import {
  Recommendation,
  type CreateRecommendationInput,
} from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'

const makeCompany = (
  id: string,
  overrides: Partial<{ ciiu: string }> = {},
): Company =>
  Company.create({
    id,
    razonSocial: `Company ${id}`,
    ciiu: overrides.ciiu ?? 'G4711',
    municipio: 'Bogotá',
    estado: 'ACTIVO',
  })

const makeRec = (
  overrides: Partial<CreateRecommendationInput>,
): Recommendation =>
  Recommendation.create({
    id: 'rec-x',
    sourceCompanyId: 'a',
    targetCompanyId: 'b',
    relationType: 'cliente',
    score: 0.5,
    reasons: Reasons.empty(),
    source: 'rule',
    ...overrides,
  })

interface Stubs {
  scanRepo: InMemoryScanRunRepository
  companyRepo: InMemoryCompanyRepository
  recRepo: InMemoryRecommendationRepository
  membershipRepo: InMemoryClusterMembershipRepository
  eventRepo: InMemoryAgentEventRepository
  syncCompanies: { execute: ReturnType<typeof vi.fn> }
  generateClusters: { execute: ReturnType<typeof vi.fn> }
  generateRecs: { execute: ReturnType<typeof vi.fn> }
  detector: OpportunityDetector
}

const makeStubs = (): Stubs => ({
  scanRepo: new InMemoryScanRunRepository(),
  companyRepo: new InMemoryCompanyRepository(),
  recRepo: new InMemoryRecommendationRepository(),
  membershipRepo: new InMemoryClusterMembershipRepository(),
  eventRepo: new InMemoryAgentEventRepository(),
  syncCompanies: { execute: vi.fn(async () => ({ synced: 0 })) },
  generateClusters: {
    execute: vi.fn(async () => ({
      predefinedClusters: 0,
      heuristicClusters: 0,
      totalMemberships: 0,
    })),
  },
  generateRecs: {
    execute: vi.fn(async () => ({
      totalRecommendations: 0,
      companiesWithRecs: 0,
      byRelationType: { cliente: 0, proveedor: 0, aliado: 0, referente: 0 },
    })),
  },
  detector: new OpportunityDetector(),
})

const buildUseCase = (stubs: Stubs): RunIncrementalScan =>
  new RunIncrementalScan(
    stubs.scanRepo,
    stubs.companyRepo,
    stubs.syncCompanies as never,
    stubs.generateClusters as never,
    stubs.generateRecs as never,
    stubs.detector,
    stubs.recRepo,
    stubs.eventRepo,
    stubs.membershipRepo,
  )

describe('RunIncrementalScan', () => {
  let stubs: Stubs

  beforeEach(() => {
    stubs = makeStubs()
  })

  describe('first run (no previous scan)', () => {
    it('uses epoch as since and runs the full pipeline', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a'), makeCompany('b')])

      const result = await useCase.execute({ trigger: 'cron' })

      expect(result.status).toBe('completed')
      expect(stubs.syncCompanies.execute).toHaveBeenCalledWith({
        since: new Date(0),
      })
      expect(stubs.generateClusters.execute).toHaveBeenCalled()
      expect(stubs.generateRecs.execute).toHaveBeenCalled()
    })
  })

  describe('subsequent run (previous completed scan exists)', () => {
    it('uses the last completed scan completedAt as since', async () => {
      const useCase = buildUseCase(stubs)
      const lastCompletedAt = new Date('2026-04-26T09:00:00Z')
      await stubs.scanRepo.save(
        ScanRun.start({
          id: 'prev',
          trigger: 'cron',
          now: new Date('2026-04-26T08:55:00Z'),
        }).complete(
          {
            companiesScanned: 1,
            clustersGenerated: 1,
            recommendationsGenerated: 1,
            eventsEmitted: 0,
          },
          lastCompletedAt,
        ),
      )
      await stubs.companyRepo.saveMany([makeCompany('a')])

      await useCase.execute({ trigger: 'cron' })

      expect(stubs.syncCompanies.execute).toHaveBeenCalledWith({
        since: lastCompletedAt,
      })
    })

    it('short-circuits to a zero-stat completed run when no companies are updated', async () => {
      const useCase = buildUseCase(stubs)
      const lastCompletedAt = new Date('2026-04-26T09:00:00Z')
      await stubs.scanRepo.save(
        ScanRun.start({
          id: 'prev',
          trigger: 'cron',
          now: new Date('2026-04-26T08:55:00Z'),
        }).complete(
          {
            companiesScanned: 0,
            clustersGenerated: 0,
            recommendationsGenerated: 0,
            eventsEmitted: 0,
          },
          lastCompletedAt,
        ),
      )
      // companyRepo empty → findUpdatedSince returns []

      const result = await useCase.execute({ trigger: 'cron' })

      expect(result.status).toBe('completed')
      expect(result.companiesScanned).toBe(0)
      expect(stubs.generateClusters.execute).not.toHaveBeenCalled()
      expect(stubs.generateRecs.execute).not.toHaveBeenCalled()
    })
  })

  describe('orchestration order', () => {
    it('snapshots previous rec keys BEFORE regenerating recommendations', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a'), makeCompany('b')])
      // previous rec — would be in snapshot
      await stubs.recRepo.saveAll([
        makeRec({
          id: 'old',
          sourceCompanyId: 'a',
          targetCompanyId: 'b',
          relationType: 'cliente',
          score: 0.9,
        }),
      ])

      // generateRecs replaces with same key — should NOT trigger event
      stubs.generateRecs.execute.mockImplementationOnce(async () => {
        await stubs.recRepo.deleteAll()
        await stubs.recRepo.saveAll([
          makeRec({
            id: 'new',
            sourceCompanyId: 'a',
            targetCompanyId: 'b',
            relationType: 'cliente',
            score: 0.95,
          }),
        ])
        return {
          totalRecommendations: 1,
          companiesWithRecs: 1,
          byRelationType: { cliente: 1, proveedor: 0, aliado: 0, referente: 0 },
        }
      })

      await useCase.execute({ trigger: 'cron' })

      const events = await stubs.eventRepo.findByCompany('a')
      expect(events).toHaveLength(0)
    })

    it('emits a high_score event for a brand-new high-score rec', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a'), makeCompany('b')])
      // no previous recs

      stubs.generateRecs.execute.mockImplementationOnce(async () => {
        await stubs.recRepo.saveAll([
          makeRec({
            id: 'new',
            sourceCompanyId: 'a',
            targetCompanyId: 'b',
            relationType: 'aliado',
            score: 0.9,
          }),
        ])
        return {
          totalRecommendations: 1,
          companiesWithRecs: 1,
          byRelationType: { cliente: 0, proveedor: 0, aliado: 1, referente: 0 },
        }
      })

      const result = await useCase.execute({ trigger: 'cron' })

      const events = await stubs.eventRepo.findByCompany('a')
      expect(events).toHaveLength(1)
      expect(events[0]!.eventType).toBe('new_high_score_match')
      expect(result.eventsEmitted).toBe(1)
    })

    it('emits cluster_member events when clusters change', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([
        makeCompany('a'),
        makeCompany('b'),
        makeCompany('c'),
      ])
      // pre-existing membership: cluster-1 has just 'a'
      await stubs.membershipRepo.saveMany([
        { clusterId: 'cluster-1', companyId: 'a' },
      ])

      stubs.generateClusters.execute.mockImplementationOnce(async () => {
        await stubs.membershipRepo.deleteAll()
        await stubs.membershipRepo.saveMany([
          { clusterId: 'cluster-1', companyId: 'a' },
          { clusterId: 'cluster-1', companyId: 'b' },
        ])
        return {
          predefinedClusters: 1,
          heuristicClusters: 0,
          totalMemberships: 2,
        }
      })

      const result = await useCase.execute({ trigger: 'cron' })

      const eventsForA = await stubs.eventRepo.findByCompany('a')
      expect(eventsForA).toHaveLength(1)
      expect(eventsForA[0]!.eventType).toBe('new_cluster_member')
      expect(eventsForA[0]!.payload).toMatchObject({
        clusterId: 'cluster-1',
        newCompanyId: 'b',
      })

      const eventsForB = await stubs.eventRepo.findByCompany('b')
      expect(eventsForB.map((e) => e.eventType)).toContain('joined_new_cluster')

      // Existing member 'a' + mirror for new member 'b'
      expect(result.eventsEmitted).toBe(2)
    })

    it('emits etapa_changed when a company moves between stages between scans', async () => {
      const useCase = buildUseCase(stubs)
      // Seed a previous completed scan so etapa diff actually fires (the
      // first run of the agent does not have a baseline).
      await stubs.scanRepo.save(
        ScanRun.start({
          id: 'previous',
          trigger: 'cron',
          now: new Date('2026-04-25T00:00:00Z'),
        }).complete(
          {
            companiesScanned: 1,
            clustersGenerated: 0,
            recommendationsGenerated: 0,
            eventsEmitted: 0,
          },
          new Date('2026-04-25T00:01:00Z'),
        ),
      )

      // Snapshot baseline: company X is in 'crecimiento'.
      const before = Company.create({
        id: 'X',
        razonSocial: 'X',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
        personal: 0,
        ingresoOperacion: 0,
      })
      await stubs.companyRepo.saveMany([before])

      // After the sync step (which we stub), the same company exists with
      // metrics that bump it to 'madurez'. We emulate this by overwriting
      // the entity inside the syncCompanies stub.
      stubs.syncCompanies.execute.mockImplementationOnce(async () => {
        await stubs.companyRepo.saveMany([
          Company.create({
            id: 'X',
            razonSocial: 'X',
            ciiu: 'G4711',
            municipio: 'SANTA MARTA',
            personal: 100,
            ingresoOperacion: 10_000_000_000,
          }),
        ])
        return { synced: 1 }
      })

      await useCase.execute({ trigger: 'cron' })

      const events = await stubs.eventRepo.findByCompany('X')
      const etapaEvents = events.filter((e) => e.eventType === 'etapa_changed')
      expect(etapaEvents).toHaveLength(1)
      // Defaults (personal=0, ingreso=0, fechaMatricula=null) → 'nacimiento';
      // post-sync (ingreso=10B) → 'madurez'.
      expect(etapaEvents[0]!.payload).toMatchObject({
        from: 'nacimiento',
        to: 'madurez',
      })
    })
  })

  describe('persistence', () => {
    it('saves a running scan first, then a completed scan with stats', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a')])

      stubs.generateClusters.execute.mockResolvedValueOnce({
        predefinedClusters: 2,
        heuristicClusters: 1,
        totalMemberships: 5,
      })
      stubs.generateRecs.execute.mockResolvedValueOnce({
        totalRecommendations: 17,
        companiesWithRecs: 3,
        byRelationType: { cliente: 5, proveedor: 4, aliado: 5, referente: 3 },
      })

      const result = await useCase.execute({ trigger: 'manual' })

      expect(result.status).toBe('completed')
      expect(result.clustersGenerated).toBe(3)
      expect(result.recommendationsGenerated).toBe(17)
      expect(result.companiesScanned).toBe(1)

      const persisted = await stubs.scanRepo.findLatest()
      expect(persisted!.status).toBe('completed')
      expect(persisted!.trigger).toBe('manual')
      expect(persisted!.clustersGenerated).toBe(3)
      expect(persisted!.recommendationsGenerated).toBe(17)
    })

    it('persists eventsEmitted in the saved scan', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a'), makeCompany('b')])

      stubs.generateRecs.execute.mockImplementationOnce(async () => {
        await stubs.recRepo.saveAll([
          makeRec({
            id: 'new',
            sourceCompanyId: 'a',
            targetCompanyId: 'b',
            relationType: 'cliente',
            score: 0.9,
          }),
        ])
        return {
          totalRecommendations: 1,
          companiesWithRecs: 1,
          byRelationType: { cliente: 1, proveedor: 0, aliado: 0, referente: 0 },
        }
      })

      await useCase.execute({ trigger: 'cron' })

      const persisted = await stubs.scanRepo.findLatest()
      expect(persisted!.eventsEmitted).toBe(1)
    })
  })

  describe('failure handling', () => {
    it('marks the scan as failed and rethrows when sync throws', async () => {
      const useCase = buildUseCase(stubs)
      stubs.syncCompanies.execute.mockRejectedValueOnce(new Error('sync down'))

      await expect(useCase.execute({ trigger: 'cron' })).rejects.toThrow(
        /sync down/,
      )

      const persisted = await stubs.scanRepo.findLatest()
      expect(persisted!.status).toBe('failed')
      expect(persisted!.errorMessage).toBe('sync down')
    })

    it('marks the scan as failed when generateClusters throws', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a')])
      stubs.generateClusters.execute.mockRejectedValueOnce(
        new Error('cluster boom'),
      )

      await expect(useCase.execute({ trigger: 'cron' })).rejects.toThrow(
        /cluster boom/,
      )

      const persisted = await stubs.scanRepo.findLatest()
      expect(persisted!.status).toBe('failed')
      expect(persisted!.errorMessage).toBe('cluster boom')
    })

    it('marks the scan as failed when generateRecs throws', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a')])
      stubs.generateRecs.execute.mockRejectedValueOnce(new Error('rec boom'))

      await expect(useCase.execute({ trigger: 'cron' })).rejects.toThrow(
        /rec boom/,
      )

      const persisted = await stubs.scanRepo.findLatest()
      expect(persisted!.status).toBe('failed')
    })

    it('serializes a Postgres-style POJO error instead of [object Object]', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a')])
      const pgError = {
        code: '22P02',
        details: null,
        hint: null,
        message: 'invalid input syntax for type uuid: ""',
      }
      stubs.generateRecs.execute.mockRejectedValueOnce(pgError)

      await expect(useCase.execute({ trigger: 'cron' })).rejects.toBe(pgError)

      const persisted = await stubs.scanRepo.findLatest()
      expect(persisted!.status).toBe('failed')
      expect(persisted!.errorMessage).not.toContain('[object Object]')
      expect(persisted!.errorMessage).toContain('22P02')
      expect(persisted!.errorMessage).toContain(
        'invalid input syntax for type uuid: ""',
      )
    })
  })

  describe('result shape', () => {
    it('returns a runId, status, and stats', async () => {
      const useCase = buildUseCase(stubs)
      await stubs.companyRepo.saveMany([makeCompany('a')])

      const result = await useCase.execute({ trigger: 'cron' })

      expect(result).toEqual(
        expect.objectContaining({
          runId: expect.any(String),
          status: 'completed',
          companiesScanned: expect.any(Number),
          clustersGenerated: expect.any(Number),
          recommendationsGenerated: expect.any(Number),
          eventsEmitted: expect.any(Number),
        }),
      )
      expect(result.runId.length).toBeGreaterThan(0)
    })
  })
})
