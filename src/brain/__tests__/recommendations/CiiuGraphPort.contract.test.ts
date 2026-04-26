/**
 * Contract test for CiiuGraphPort.
 *
 * Both adapters (InMemory and Supabase) must honour the same contract.
 * Adding a third adapter? Add it here — this is the conformance gate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CiiuGraphPort } from '@/recommendations/domain/ports/CiiuGraphPort'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'
import { SupabaseCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/SupabaseCiiuGraphRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

// ─── helpers ──────────────────────────────────────────────────────────────────

function edge(
  ciiuOrigen: string,
  ciiuDestino: string,
  relationType: 'proveedor' | 'cliente' | 'aliado',
  confidence: number,
): CiiuEdge {
  return CiiuEdge.create({
    ciiuOrigen,
    ciiuDestino,
    hasMatch: true,
    relationType,
    confidence,
    modelVersion: null,
  })
}

/** Shared fixtures that both adapters must handle identically */
const FIXTURES: CiiuEdge[] = [
  edge('5511', '9601', 'proveedor', 0.9),
  edge('5511', '4711', 'cliente', 0.6),
  edge('0122', '4631', 'aliado', 0.75),
  edge('A', '*', 'proveedor', 0.95), // wildcard — must always be excluded
  CiiuEdge.create({
    // hasMatch=false — must be excluded
    ciiuOrigen: 'X',
    ciiuDestino: 'Y',
    hasMatch: false,
    relationType: null,
    confidence: 0.9,
    modelVersion: null,
  }),
]

// ─── factory helpers ───────────────────────────────────────────────────────────

function makeInMemoryAdapter(): CiiuGraphPort {
  const repo = new InMemoryCiiuGraphRepository()
  repo.seed(FIXTURES)
  return repo
}

function makeSupabaseAdapter(): CiiuGraphPort {
  /**
   * Fake Supabase client that simulates SQL filtering on the FIXTURES.
   * The builder accumulates filter predicates and applies them lazily
   * when `.then()` is called — this mirrors how the real Supabase client
   * executes only when awaited.
   */
  const allRows = FIXTURES.map((e) => ({
    ciiu_origen: e.ciiuOrigen,
    ciiu_destino: e.ciiuDestino,
    has_match: e.hasMatch,
    relation_type: e.relationType,
    confidence: e.confidence,
    model_version: e.modelVersion,
  }))

  // Predicates accumulate via .eq/.gte/.neq/.in chains
  const predicates: Array<(row: (typeof allRows)[number]) => boolean> = []

  const builder = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation((col: string, val: unknown) => {
      predicates.push((r) => (r as Record<string, unknown>)[col] === val)
      return builder
    }),
    gte: vi.fn().mockImplementation((col: string, val: number) => {
      predicates.push(
        (r) => ((r as Record<string, unknown>)[col] as number) >= val,
      )
      return builder
    }),
    neq: vi.fn().mockImplementation((col: string, val: unknown) => {
      predicates.push((r) => (r as Record<string, unknown>)[col] !== val)
      return builder
    }),
    in: vi.fn().mockImplementation((col: string, values: unknown[]) => {
      predicates.push((r) =>
        values.includes((r as Record<string, unknown>)[col]),
      )
      return builder
    }),
    then: (
      onF: (r: { data: unknown; error: unknown }) => unknown,
    ): Promise<unknown> => {
      const filtered = allRows.filter((r) => predicates.every((p) => p(r)))
      predicates.length = 0 // reset for next call
      return Promise.resolve({ data: filtered, error: null }).then(onF)
    },
  }

  return new SupabaseCiiuGraphRepository(
    builder as unknown as BrainSupabaseClient,
  )
}

// ─── shared contract suite ────────────────────────────────────────────────────

function runContractSuite(name: string, getAdapter: () => CiiuGraphPort) {
  describe(`CiiuGraphPort contract — ${name}`, () => {
    let adapter: CiiuGraphPort

    beforeEach(() => {
      adapter = getAdapter()
    })

    it('scenario: threshold filter — excludes edges below threshold', async () => {
      // Only 5511→9601 (0.9) and 0122→4631 (0.75) are >= 0.75
      const pairs = await adapter.getMatchingPairs(0.75)
      const destinos = pairs.map((e) => e.ciiuDestino).sort()
      expect(destinos).toEqual(['4631', '9601'])
    })

    it('scenario: relationType filter — single type', async () => {
      const pairs = await adapter.getMatchingPairs(0, ['proveedor'])
      expect(pairs.map((e) => e.ciiuDestino)).toEqual(['9601'])
    })

    it('scenario: relationType filter — multiple types', async () => {
      const pairs = await adapter.getMatchingPairs(0, ['proveedor', 'aliado'])
      const destinos = pairs.map((e) => e.ciiuDestino).sort()
      expect(destinos).toEqual(['4631', '9601'])
    })

    it('scenario: wildcard exclusion — ciiuDestino "*" never appears', async () => {
      const pairs = await adapter.getMatchingPairs(0)
      expect(pairs.every((e) => e.ciiuDestino !== '*')).toBe(true)
    })

    it('scenario: empty result — threshold too high returns []', async () => {
      const pairs = await adapter.getMatchingPairs(1.0)
      expect(pairs).toEqual([])
    })

    it('scenario: getEdgesByOrigin — filters by origin and threshold', async () => {
      const edges = await adapter.getEdgesByOrigin('5511', 0.7)
      // Only 5511→9601 (0.9) qualifies; 5511→4711 (0.6) is below threshold
      expect(edges).toHaveLength(1)
      expect(edges[0].ciiuDestino).toBe('9601')
    })
  })
}

// ─── run for both adapters ────────────────────────────────────────────────────

runContractSuite('InMemoryCiiuGraphRepository', makeInMemoryAdapter)
runContractSuite('SupabaseCiiuGraphRepository', makeSupabaseAdapter)
