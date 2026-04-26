import { describe, expect, it, vi } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { AiMatchEngine } from '@/recommendations/application/services/AiMatchEngine'
import { CiiuPairEvaluator } from '@/recommendations/application/services/CiiuPairEvaluator'
import { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'
import { InMemoryAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository'
import { StubGeminiAdapter } from '@/shared/infrastructure/gemini/StubGeminiAdapter'

const ciius = [
  ['4631', 'Mayorista', 'G', '46', '463'],
  ['5611', 'Restaurantes', 'I', '56', '561'],
  ['0122', 'Banano', 'A', '01', '012'],
  ['4720', 'Minorista', 'G', '47', '472'],
] as const

const ciiuRepo = (() => {
  const repo = new InMemoryCiiuTaxonomyRepository(
    ciius.map(([code, titulo, seccion, division, grupo]) =>
      CiiuActivity.create({
        code,
        titulo,
        seccion,
        division,
        grupo,
        tituloSeccion: 'x',
        tituloDivision: 'x',
        tituloGrupo: 'x',
      }),
    ),
  )
  return repo
})()

function newSetup() {
  const cache = new InMemoryAiMatchCacheRepository()
  const gemini = new StubGeminiAdapter('', {
    has_match: true,
    relation_type: 'cliente',
    confidence: 0.8,
    reason: 'r',
  })
  const engine = new AiMatchEngine(gemini, cache, ciiuRepo)
  const evaluator = new CiiuPairEvaluator(engine, cache)
  return { cache, gemini, engine, evaluator }
}

describe('CiiuPairEvaluator.evaluateAll', () => {
  it('evaluates every pair when cache is empty', async () => {
    const { evaluator, gemini } = newSetup()
    const spy = vi.spyOn(gemini, 'inferStructured')

    const stats = await evaluator.evaluateAll(
      new Set(['4631|5611', '0122|4631']),
    )

    expect(stats.total).toBe(2)
    expect(stats.evaluated).toBe(2)
    expect(stats.cached).toBe(0)
    expect(stats.errors).toBe(0)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('skips pairs that are already cached', async () => {
    const { cache, evaluator, gemini } = newSetup()
    await cache.put(
      AiMatchCacheEntry.create({
        ciiuOrigen: '4631',
        ciiuDestino: '5611',
        hasMatch: true,
        relationType: 'cliente',
        confidence: 0.9,
      }),
    )
    const spy = vi.spyOn(gemini, 'inferStructured')

    const stats = await evaluator.evaluateAll(
      new Set(['4631|5611', '0122|4631']),
    )

    expect(stats.cached).toBe(1)
    expect(stats.evaluated).toBe(1)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('reports errors without aborting other pairs', async () => {
    const { evaluator, engine } = newSetup()
    const original = engine.evaluate.bind(engine)
    vi.spyOn(engine, 'evaluate').mockImplementation(async (a, b) => {
      if (a === '0122' && b === '4631') throw new Error('boom')
      return original(a, b)
    })

    const stats = await evaluator.evaluateAll(
      new Set(['4631|5611', '0122|4631']),
    )

    expect(stats.errors).toBe(1)
    expect(stats.evaluated).toBe(1)
  })

  it('invokes onProgress for every completed pair', async () => {
    const { evaluator } = newSetup()
    const calls: Array<[number, number]> = []

    await evaluator.evaluateAll(new Set(['4631|5611', '0122|4631']), {
      onProgress: (done, total) => calls.push([done, total]),
    })

    expect(calls).toHaveLength(2)
    expect(calls[calls.length - 1]).toEqual([2, 2])
  })

  it('returns zero counts when given an empty set', async () => {
    const { evaluator } = newSetup()
    const stats = await evaluator.evaluateAll(new Set())
    expect(stats).toEqual({ total: 0, cached: 0, evaluated: 0, errors: 0 })
  })

  it('respects concurrency by limiting in-flight workers', async () => {
    const { evaluator, engine } = newSetup()
    let inFlight = 0
    let peak = 0
    vi.spyOn(engine, 'evaluate').mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      return {
        hasMatch: true,
        relationType: 'cliente',
        confidence: 0.8,
        reason: 'r',
      }
    })

    const pairs = new Set([
      '4631|5611',
      '0122|4631',
      '4631|4720',
      '0122|5611',
      '4720|5611',
      '0122|4720',
    ])
    await evaluator.evaluateAll(pairs, { concurrency: 2 })

    expect(peak).toBeLessThanOrEqual(2)
  })
})
