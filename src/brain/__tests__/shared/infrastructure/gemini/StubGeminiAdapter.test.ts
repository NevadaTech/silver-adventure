import { describe, it, expect } from 'vitest'
import { StubGeminiAdapter } from '@/shared/infrastructure/gemini/StubGeminiAdapter'

describe('StubGeminiAdapter', () => {
  it('returns the configured text response', async () => {
    const adapter = new StubGeminiAdapter('canned text')
    expect(await adapter.generateText('any prompt')).toBe('canned text')
  })

  it('defaults the text response when none is provided', async () => {
    const adapter = new StubGeminiAdapter()
    expect(await adapter.generateText('x')).toBe('stub response')
  })

  it('passes the configured structured response through the validator', async () => {
    const payload = { foo: 'bar' }
    const adapter = new StubGeminiAdapter('text', payload)
    const out = await adapter.inferStructured('any prompt', (raw) => {
      expect(raw).toBe(payload)
      return raw as { foo: string }
    })
    expect(out.foo).toBe('bar')
  })
})
