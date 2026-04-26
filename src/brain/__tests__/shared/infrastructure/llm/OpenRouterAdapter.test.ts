import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/shared/infrastructure/env', () => ({
  env: {
    OPENROUTER_API_KEY: 'test-or-key',
    OPENROUTER_CHAT_MODEL: 'google/gemma-4-31b-it:free',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_APP_URL: 'https://silveradventure.app',
    OPENROUTER_APP_NAME: 'Silver Adventure',
  },
}))

import { OpenRouterAdapter } from '@/shared/infrastructure/llm/OpenRouterAdapter'

const okResponse = (content: string) =>
  new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )

const errResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('OpenRouterAdapter', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('generateText', () => {
    it('POSTs to the configured base URL chat completions endpoint', async () => {
      fetchMock.mockResolvedValue(okResponse('hola'))
      const adapter = new OpenRouterAdapter()

      await adapter.generateText('di hola')

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
      expect(init.method).toBe('POST')
    })

    it('sends Authorization, HTTP-Referer, X-Title and Content-Type headers', async () => {
      fetchMock.mockResolvedValue(okResponse('hola'))
      const adapter = new OpenRouterAdapter()

      await adapter.generateText('di hola')

      const [, init] = fetchMock.mock.calls[0]
      expect(init.headers).toMatchObject({
        Authorization: 'Bearer test-or-key',
        'HTTP-Referer': 'https://silveradventure.app',
        'X-Title': 'Silver Adventure',
        'Content-Type': 'application/json',
      })
    })

    it('sends the configured model and a single user message', async () => {
      fetchMock.mockResolvedValue(okResponse('hola'))
      const adapter = new OpenRouterAdapter()

      await adapter.generateText('di hola')

      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      expect(body).toEqual({
        model: 'google/gemma-4-31b-it:free',
        messages: [{ role: 'user', content: 'di hola' }],
      })
    })

    it('returns the assistant content from choices[0].message.content', async () => {
      fetchMock.mockResolvedValue(okResponse('hola mundo'))
      const adapter = new OpenRouterAdapter()

      const out = await adapter.generateText('di hola')

      expect(out).toBe('hola mundo')
    })

    it('throws with status and error body when response is non-200', async () => {
      fetchMock.mockResolvedValue(
        errResponse(429, { error: { message: 'rate limited' } }),
      )
      const adapter = new OpenRouterAdapter()

      await expect(adapter.generateText('p')).rejects.toThrow(
        /OpenRouter.*429.*rate limited/,
      )
    })

    it('throws when response shape is unexpected (no choices)', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      )
      const adapter = new OpenRouterAdapter()

      await expect(adapter.generateText('p')).rejects.toThrow(
        /OpenRouter.*no content/i,
      )
    })

    it('propagates network errors from fetch', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
      const adapter = new OpenRouterAdapter()

      await expect(adapter.generateText('p')).rejects.toThrow(/ECONNREFUSED/)
    })
  })

  describe('inferStructured', () => {
    it('parses raw JSON output and passes it to the validator', async () => {
      fetchMock.mockResolvedValue(okResponse('{"ok": true, "n": 42}'))
      const validator = vi.fn((raw) => raw as { ok: boolean; n: number })

      const adapter = new OpenRouterAdapter()
      const out = await adapter.inferStructured('p', validator)

      expect(validator).toHaveBeenCalledWith({ ok: true, n: 42 })
      expect(out).toEqual({ ok: true, n: 42 })
    })

    it('strips ```json ... ``` fences before parsing', async () => {
      fetchMock.mockResolvedValue(okResponse('```json\n{"ok": true}\n```'))
      const adapter = new OpenRouterAdapter()
      const out = await adapter.inferStructured(
        'p',
        (raw) => raw as { ok: boolean },
      )
      expect(out.ok).toBe(true)
    })

    it('strips bare ``` fences (no language tag) before parsing', async () => {
      fetchMock.mockResolvedValue(okResponse('```\n{"ok": true}\n```'))
      const adapter = new OpenRouterAdapter()
      const out = await adapter.inferStructured(
        'p',
        (raw) => raw as { ok: boolean },
      )
      expect(out.ok).toBe(true)
    })

    it('strips leading and trailing whitespace before parsing', async () => {
      fetchMock.mockResolvedValue(okResponse('   {"ok": true}   \n'))
      const adapter = new OpenRouterAdapter()
      const out = await adapter.inferStructured(
        'p',
        (raw) => raw as { ok: boolean },
      )
      expect(out.ok).toBe(true)
    })

    it('throws a descriptive error when the model returns non-JSON', async () => {
      fetchMock.mockResolvedValue(okResponse('lo siento, no puedo'))
      const adapter = new OpenRouterAdapter()
      await expect(adapter.inferStructured('p', (raw) => raw)).rejects.toThrow(
        /non-JSON/,
      )
    })

    it('propagates validator errors', async () => {
      fetchMock.mockResolvedValue(okResponse('{"x": 1}'))
      const adapter = new OpenRouterAdapter()
      await expect(
        adapter.inferStructured('p', () => {
          throw new Error('schema mismatch')
        }),
      ).rejects.toThrow(/schema mismatch/)
    })
  })

  describe('optional headers', () => {
    it('omits HTTP-Referer and X-Title when env vars are not set', async () => {
      vi.resetModules()
      vi.doMock('@/shared/infrastructure/env', () => ({
        env: {
          OPENROUTER_API_KEY: 'test-or-key',
          OPENROUTER_CHAT_MODEL: 'google/gemma-4-31b-it:free',
          OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
          OPENROUTER_APP_URL: undefined,
          OPENROUTER_APP_NAME: undefined,
        },
      }))

      const { OpenRouterAdapter: FreshAdapter } =
        await import('@/shared/infrastructure/llm/OpenRouterAdapter')
      fetchMock.mockResolvedValue(okResponse('ok'))

      const adapter = new FreshAdapter()
      await adapter.generateText('p')

      const [, init] = fetchMock.mock.calls[0]
      expect(init.headers).not.toHaveProperty('HTTP-Referer')
      expect(init.headers).not.toHaveProperty('X-Title')

      vi.doUnmock('@/shared/infrastructure/env')
    })
  })
})
