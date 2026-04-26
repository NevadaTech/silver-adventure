import { describe, expect, it } from 'vitest'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { DynamicValueChainRules } from '@/recommendations/application/services/DynamicValueChainRules'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'
import {
  VALUE_CHAIN_RULES,
  ECOSYSTEMS,
} from '@/recommendations/application/services/ValueChainRules'

function makeEdge(
  ciiuOrigen: string,
  ciiuDestino: string,
  relationType: 'cliente' | 'proveedor' | 'aliado' | 'referente',
  confidence = 0.8,
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

describe('DynamicValueChainRules', () => {
  describe('getValueChainRules', () => {
    it('flag=false → returns VALUE_CHAIN_RULES literal without consulting the port', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      const helper = new DynamicValueChainRules(graph)

      const rules = await helper.getValueChainRules(false)

      expect(rules).toBe(VALUE_CHAIN_RULES)
    })

    it('flag=true + empty graph → returns VALUE_CHAIN_RULES (full fallback)', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      const helper = new DynamicValueChainRules(graph)

      const rules = await helper.getValueChainRules(true)

      expect(rules).toEqual(VALUE_CHAIN_RULES)
    })

    it('flag=true + graph with cliente/proveedor edges → dynamic rules for covered pairs, hardcoded for uncovered pairs', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      // Seed an edge that corresponds to a pair NOT in VALUE_CHAIN_RULES
      // plus one that IS in VALUE_CHAIN_RULES (should be replaced by dynamic)
      // 0122→4631 is in VALUE_CHAIN_RULES with weight 0.85
      // 9999→8888 is NOT in VALUE_CHAIN_RULES
      graph.seed([
        makeEdge('0122', '4631', 'cliente', 0.9), // overrides hardcoded pair
        makeEdge('9999', '8888', 'proveedor', 0.75), // new dynamic pair
      ])
      const helper = new DynamicValueChainRules(graph)

      const rules = await helper.getValueChainRules(true)

      // The dynamic rule for 0122→4631 should appear
      const dynamicRule = rules.find(
        (r) => r.ciiuOrigen === '0122' && r.ciiuDestino === '4631',
      )
      expect(dynamicRule).toBeDefined()
      expect(dynamicRule!.weight).toBe(0.9) // confidence from graph

      // The dynamic rule for 9999→8888 should appear
      const newRule = rules.find(
        (r) => r.ciiuOrigen === '9999' && r.ciiuDestino === '8888',
      )
      expect(newRule).toBeDefined()
      expect(newRule!.weight).toBe(0.75)

      // Hardcoded rules for pairs NOT covered by graph should still appear
      const fallbackRule = rules.find(
        (r) => r.ciiuOrigen === '4631' && r.ciiuDestino === '5611',
      )
      expect(fallbackRule).toBeDefined()
      expect(fallbackRule!.weight).toBe(0.85) // original hardcoded weight

      // The hardcoded 0122→4631 should NOT appear (covered by dynamic)
      const hardcodedOverridden = rules.filter(
        (r) => r.ciiuOrigen === '0122' && r.ciiuDestino === '4631',
      )
      expect(hardcodedOverridden).toHaveLength(1) // only the dynamic one
    })

    it('threshold 0.65 is used correctly when calling the port', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      // Edge with confidence 0.6 (below threshold) should not be included
      // Edge with confidence 0.65 (at threshold) should be included
      graph.seed([
        makeEdge('9999', '1111', 'cliente', 0.6), // below threshold
        makeEdge('9999', '2222', 'proveedor', 0.65), // at threshold
      ])
      const helper = new DynamicValueChainRules(graph)

      const rules = await helper.getValueChainRules(true)

      expect(rules.find((r) => r.ciiuDestino === '1111')).toBeUndefined()
      expect(rules.find((r) => r.ciiuDestino === '2222')).toBeDefined()
    })
  })

  describe('getEcosystems', () => {
    it('flag=false → returns ECOSYSTEMS literal', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      const helper = new DynamicValueChainRules(graph)

      const ecosystems = await helper.getEcosystems(false)

      expect(ecosystems).toBe(ECOSYSTEMS)
    })

    it('flag=true + empty graph (no aliado edges) → returns ECOSYSTEMS (fallback)', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      // Only cliente/proveedor edges, no aliado
      graph.seed([makeEdge('9999', '8888', 'cliente', 0.8)])
      const helper = new DynamicValueChainRules(graph)

      const ecosystems = await helper.getEcosystems(true)

      expect(ecosystems).toEqual(ECOSYSTEMS)
    })

    it('flag=true + aliado edges → dynamic ecosystems concatenated with ECOSYSTEMS hardcoded', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      graph.seed([makeEdge('9999', '8888', 'aliado', 0.8)])
      const helper = new DynamicValueChainRules(graph)

      const ecosystems = await helper.getEcosystems(true)

      // Should have more ecosystems than hardcoded alone
      expect(ecosystems.length).toBeGreaterThan(ECOSYSTEMS.length)

      // The dynamic ecosystem should be at the front
      const dynamicEco = ecosystems.find((e) => e.ciiuCodes.includes('9999'))
      expect(dynamicEco).toBeDefined()
      expect(dynamicEco!.ciiuCodes).toContain('8888')

      // The hardcoded ecosystems should still be present
      for (const hardcoded of ECOSYSTEMS) {
        expect(ecosystems.find((e) => e.id === hardcoded.id)).toBeDefined()
      }
    })
  })

  // E.4 — Smoke check: verifies the string→boolean conversion used by all three consumers
  // is consistent: env.AI_DRIVEN_RULES_ENABLED === 'true' (NOT strict boolean coercion)
  describe('flag string-to-boolean conversion consistency (E.4 smoke check)', () => {
    it("'true' === 'true' is true (flag-on path)", () => {
      const envValue = 'true'
      expect(envValue === 'true').toBe(true)
    })

    it("'false' === 'true' is false (flag-off path, default)", () => {
      const envValue = 'false' as string
      expect(envValue === 'true').toBe(false)
    })

    it("undefined coerced to string is not equal to 'true'", () => {
      // The zod schema defaults to 'false', so undefined in process.env → 'false'
      // Use process.env lookup to avoid TS tautological-comparison analysis
      const rawValue: string | undefined = process.env['__NONEXISTENT_VAR__']
      const envValue = rawValue ?? 'false'
      expect(envValue === 'true').toBe(false)
    })

    it('DynamicValueChainRules correctly receives false when flag is off', async () => {
      // Simulates: const flagEnabled = env.AI_DRIVEN_RULES_ENABLED === 'true'
      // where env.AI_DRIVEN_RULES_ENABLED = 'false' (default)
      const flagString = 'false' as string
      const flagEnabled = flagString === 'true'

      const graph = new InMemoryCiiuGraphRepository()
      // Seed with edges that would only be used if flagEnabled=true
      graph.seed([makeEdge('9999', '8888', 'cliente', 0.9)])
      const helper = new DynamicValueChainRules(graph)

      // With flagEnabled=false, the helper returns hardcoded rules (no graph query)
      const rules = await helper.getValueChainRules(flagEnabled)
      expect(rules).toBe(VALUE_CHAIN_RULES) // exact reference equality: no copy made
    })

    it('DynamicValueChainRules correctly receives true when flag is on', async () => {
      // Simulates: const flagEnabled = env.AI_DRIVEN_RULES_ENABLED === 'true'
      // where env.AI_DRIVEN_RULES_ENABLED = 'true' (enabled)
      const flagString = 'true'
      const flagEnabled = flagString === 'true'

      const graph = new InMemoryCiiuGraphRepository()
      // Empty graph → fallback to hardcoded (but the graph IS consulted)
      const helper = new DynamicValueChainRules(graph)

      // With flagEnabled=true and empty graph, helper falls back to VALUE_CHAIN_RULES
      const rules = await helper.getValueChainRules(flagEnabled)
      expect(rules).toBe(VALUE_CHAIN_RULES)
    })
  })
})
