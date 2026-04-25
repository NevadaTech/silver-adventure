import { describe, it, expect } from 'vitest'

try {
  process.loadEnvFile()
} catch {
  // .env not present — fall back to process.env as-is
}

const hasKey = !!process.env.GEMINI_API_KEY

describe.skipIf(!hasKey)('GeminiAdapter (real API)', () => {
  it('generateText returns non-empty string', async () => {
    const { GeminiAdapter } =
      await import('@/shared/infrastructure/gemini/GeminiAdapter')
    const adapter = new GeminiAdapter()
    const out = await adapter.generateText('Di "hola" en una palabra')
    expect(out.toLowerCase()).toContain('hola')
  }, 30_000)

  it('inferStructured parses JSON', async () => {
    const { GeminiAdapter } =
      await import('@/shared/infrastructure/gemini/GeminiAdapter')
    const adapter = new GeminiAdapter()
    const out = await adapter.inferStructured(
      'Devuelve JSON con la forma { "ok": true }. Solo el JSON, sin prosa.',
      (raw) => {
        if (typeof raw !== 'object' || raw === null || !('ok' in raw)) {
          throw new Error('invalid')
        }
        return raw as { ok: boolean }
      },
    )
    expect(out.ok).toBe(true)
  }, 30_000)
})
