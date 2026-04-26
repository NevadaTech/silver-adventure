import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted lifts these initialisations to run BEFORE the auto-hoisted
// vi.mock calls below — without it, the mock factory would close over
// uninitialised `const` bindings and throw at import time.
const { generateContentMock, getGenerativeModelMock, GoogleGenerativeAIMock } =
  vi.hoisted(() => {
    const generateContentMock = vi.fn()
    const getGenerativeModelMock = vi.fn(() => ({
      generateContent: generateContentMock,
    }))
    // Regular function expression — arrows lack [[Construct]] so they can't
    // be invoked with `new GoogleGenerativeAI(key)`.
    const GoogleGenerativeAIMock = vi.fn(function () {
      return { getGenerativeModel: getGenerativeModelMock }
    })
    return {
      generateContentMock,
      getGenerativeModelMock,
      GoogleGenerativeAIMock,
    }
  })

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: GoogleGenerativeAIMock,
}))

vi.mock('@/shared/infrastructure/env', () => ({
  env: {
    GEMINI_API_KEY: 'test-api-key',
    GEMINI_CHAT_MODEL: 'gemini-test-model',
  },
}))

import { GeminiAdapter } from '@/shared/infrastructure/llm/GeminiAdapter'

describe('GeminiAdapter', () => {
  beforeEach(() => {
    generateContentMock.mockReset()
    getGenerativeModelMock.mockClear()
    GoogleGenerativeAIMock.mockClear()
  })

  describe('constructor', () => {
    it('initialises the SDK client with the configured API key', () => {
      new GeminiAdapter()
      expect(GoogleGenerativeAIMock).toHaveBeenCalledWith('test-api-key')
    })
  })

  describe('generateText', () => {
    it('queries the configured model with the prompt and returns text()', async () => {
      generateContentMock.mockResolvedValue({
        response: { text: () => 'hola mundo' },
      })

      const adapter = new GeminiAdapter()
      const out = await adapter.generateText('di hola')

      expect(out).toBe('hola mundo')
      expect(getGenerativeModelMock).toHaveBeenCalledWith({
        model: 'gemini-test-model',
      })
      expect(generateContentMock).toHaveBeenCalledWith('di hola')
    })

    it('propagates errors from the SDK', async () => {
      generateContentMock.mockRejectedValue(new Error('rate limited'))
      const adapter = new GeminiAdapter()
      await expect(adapter.generateText('p')).rejects.toThrow(/rate limited/)
    })
  })

  describe('inferStructured', () => {
    it('parses raw JSON output and passes it to the validator', async () => {
      generateContentMock.mockResolvedValue({
        response: { text: () => '{"ok": true, "n": 42}' },
      })
      const validator = vi.fn((raw) => raw as { ok: boolean; n: number })

      const adapter = new GeminiAdapter()
      const out = await adapter.inferStructured('p', validator)

      expect(validator).toHaveBeenCalledWith({ ok: true, n: 42 })
      expect(out).toEqual({ ok: true, n: 42 })
    })

    it('strips ```json ... ``` fences before parsing', async () => {
      generateContentMock.mockResolvedValue({
        response: { text: () => '```json\n{"ok": true}\n```' },
      })
      const adapter = new GeminiAdapter()
      const out = await adapter.inferStructured(
        'p',
        (raw) => raw as { ok: boolean },
      )
      expect(out.ok).toBe(true)
    })

    it('strips trailing whitespace before parsing', async () => {
      generateContentMock.mockResolvedValue({
        response: { text: () => '   {"ok": true}   \n' },
      })
      const adapter = new GeminiAdapter()
      const out = await adapter.inferStructured(
        'p',
        (raw) => raw as { ok: boolean },
      )
      expect(out.ok).toBe(true)
    })

    it('throws a descriptive error when the model returns non-JSON', async () => {
      generateContentMock.mockResolvedValue({
        response: { text: () => 'lo siento, no puedo' },
      })
      const adapter = new GeminiAdapter()
      await expect(adapter.inferStructured('p', (raw) => raw)).rejects.toThrow(
        /non-JSON/,
      )
    })

    it('returns whatever the validator returns (transformations supported)', async () => {
      generateContentMock.mockResolvedValue({
        response: { text: () => '{"x": 21}' },
      })
      const adapter = new GeminiAdapter()
      const out = await adapter.inferStructured('p', (raw) => ({
        doubled: (raw as { x: number }).x * 2,
      }))
      expect(out).toEqual({ doubled: 42 })
    })

    it('propagates validator errors', async () => {
      generateContentMock.mockResolvedValue({
        response: { text: () => '{"x": 1}' },
      })
      const adapter = new GeminiAdapter()
      await expect(
        adapter.inferStructured('p', () => {
          throw new Error('schema mismatch')
        }),
      ).rejects.toThrow(/schema mismatch/)
    })
  })
})
