import { describe, expect, it, vi } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { AiMatchEngine } from '@/recommendations/application/services/AiMatchEngine'
import { InMemoryAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository'
import { StubLlmAdapter } from '@/shared/infrastructure/llm/StubLlmAdapter'

const mayorista = CiiuActivity.create({
  code: '4631',
  titulo: 'Mayorista alimentos',
  seccion: 'G',
  division: '46',
  grupo: '463',
  tituloSeccion: 'Comercio',
  tituloDivision: 'Mayorista',
  tituloGrupo: 'Alimentos',
})

const restaurante = CiiuActivity.create({
  code: '5611',
  titulo: 'Restaurantes',
  seccion: 'I',
  division: '56',
  grupo: '561',
  tituloSeccion: 'Alojamiento',
  tituloDivision: 'Comidas',
  tituloGrupo: 'Restaurantes',
})

describe('AiMatchEngine', () => {
  it('short-circuits to referente when ciiuOrigen === ciiuDestino without calling Gemini', async () => {
    const gemini = new StubLlmAdapter('', { has_match: true })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository()
    const spy = vi.spyOn(gemini, 'inferStructured')

    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)
    const result = await engine.evaluate('5611', '5611')

    expect(result.hasMatch).toBe(true)
    expect(result.relationType).toBe('referente')
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
    expect(spy).not.toHaveBeenCalled()
    expect(await cache.size()).toBe(1)
  })

  it('caches the result on second call with the same pair', async () => {
    const gemini = new StubLlmAdapter('', {
      has_match: true,
      relation_type: 'cliente',
      confidence: 0.85,
      reason: 'mayorista vende a restaurante',
    })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
      mayorista,
      restaurante,
    ])
    const spy = vi.spyOn(gemini, 'inferStructured')
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)

    const r1 = await engine.evaluate('4631', '5611')
    expect(r1.hasMatch).toBe(true)
    expect(r1.relationType).toBe('cliente')
    expect(spy).toHaveBeenCalledTimes(1)

    const r2 = await engine.evaluate('4631', '5611')
    expect(r2.relationType).toBe('cliente')
    expect(r2.confidence).toBe(0.85)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('returns no-match when CIIU origen is missing in DIAN taxonomy', async () => {
    const gemini = new StubLlmAdapter('', { has_match: true })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository()
    const spy = vi.spyOn(gemini, 'inferStructured')
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)

    const result = await engine.evaluate('9999', '8888')
    expect(result.hasMatch).toBe(false)
    expect(result.confidence).toBe(0)
    expect(result.relationType).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    expect(await cache.size()).toBe(1)
  })

  it('returns no-match when only one CIIU is missing', async () => {
    const gemini = new StubLlmAdapter('', { has_match: true })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([mayorista])
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)

    const result = await engine.evaluate('4631', '8888')
    expect(result.hasMatch).toBe(false)
  })

  it('includes applicable rules in the prompt as guidance', async () => {
    let capturedPrompt = ''
    const gemini = new StubLlmAdapter('', {
      has_match: true,
      relation_type: 'cliente',
      confidence: 0.9,
      reason: 'x',
    })
    const original = gemini.inferStructured.bind(gemini)
    gemini.inferStructured = async (prompt, validate) => {
      capturedPrompt = prompt
      return original(prompt, validate)
    }
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
      mayorista,
      restaurante,
    ])
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)

    await engine.evaluate('4631', '5611')
    expect(capturedPrompt).toContain(
      'Mayorista de alimentos abastece restaurantes',
    )
    expect(capturedPrompt).toContain('CIIU 4631')
    expect(capturedPrompt).toContain('CIIU 5611')
  })

  it('falls back to "no rules apply" message when no rules match the pair', async () => {
    let capturedPrompt = ''
    const gemini = new StubLlmAdapter('', {
      has_match: false,
      relation_type: null,
      confidence: 0,
      reason: 'no relation',
    })
    gemini.inferStructured = async (prompt, validate) => {
      capturedPrompt = prompt
      return validate({
        has_match: false,
        relation_type: null,
        confidence: 0,
        reason: 'no relation',
      })
    }
    const educacion = CiiuActivity.create({
      code: '8512',
      titulo: 'Educación primaria',
      seccion: 'P',
      division: '85',
      grupo: '851',
      tituloSeccion: 'Educación',
      tituloDivision: 'Educación',
      tituloGrupo: 'Educación primaria',
    })
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([mayorista, educacion])
    const engine = new AiMatchEngine(
      gemini,
      new InMemoryAiMatchCacheRepository(),
      ciiuRepo,
    )

    await engine.evaluate('4631', '8512')
    expect(capturedPrompt).toContain('ninguna regla')
  })

  it('clamps confidence into 0..1 range', async () => {
    const gemini = new StubLlmAdapter('', {
      has_match: true,
      relation_type: 'cliente',
      confidence: 1.5,
      reason: 'r',
    })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
      mayorista,
      restaurante,
    ])
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)

    const result = await engine.evaluate('4631', '5611')
    expect(result.confidence).toBe(1)
  })

  it('treats invalid relation_type from Gemini as null', async () => {
    const gemini = new StubLlmAdapter('', {
      has_match: true,
      relation_type: 'enemigo',
      confidence: 0.7,
      reason: 'r',
    })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
      mayorista,
      restaurante,
    ])
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)

    const result = await engine.evaluate('4631', '5611')
    expect(result.relationType).toBeNull()
  })

  it('persists the cache entry after Gemini call', async () => {
    const gemini = new StubLlmAdapter('', {
      has_match: true,
      relation_type: 'cliente',
      confidence: 0.85,
      reason: 'r',
    })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
      mayorista,
      restaurante,
    ])
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)

    await engine.evaluate('4631', '5611')
    const entry = await cache.get('4631', '5611')
    expect(entry).not.toBeNull()
    expect(entry!.hasMatch).toBe(true)
    expect(entry!.relationType).toBe('cliente')
  })

  it('persists modelVersion from env.GEMINI_CHAT_MODEL when caching a result', async () => {
    const gemini = new StubLlmAdapter('', {
      has_match: true,
      relation_type: 'cliente',
      confidence: 0.85,
      reason: 'r',
    })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
      mayorista,
      restaurante,
    ])
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)

    await engine.evaluate('4631', '5611')
    const entry = await cache.get('4631', '5611')
    expect(entry).not.toBeNull()
    // modelVersion should be the value from env.GEMINI_CHAT_MODEL (default: 'gemini-2.5-flash')
    expect(entry!.modelVersion).toBeTruthy()
    expect(typeof entry!.modelVersion).toBe('string')
  })
})
