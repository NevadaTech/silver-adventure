import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const setEnv = (provider: 'openrouter' | 'gemini') => {
  vi.doMock('@/shared/infrastructure/env', () => ({
    env: {
      LLM_PROVIDER: provider,
      OPENROUTER_API_KEY: 'or-key',
      OPENROUTER_CHAT_MODEL: 'google/gemma-4-31b-it:free',
      OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
      OPENROUTER_APP_URL: undefined,
      OPENROUTER_APP_NAME: undefined,
      GEMINI_API_KEY: 'gem-key',
      GEMINI_CHAT_MODEL: 'gemini-2.5-flash',
    },
  }))
}

describe('createLlmAdapter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.doUnmock('@/shared/infrastructure/env')
    vi.unstubAllGlobals()
  })

  it('returns OpenRouterAdapter when LLM_PROVIDER=openrouter', async () => {
    setEnv('openrouter')
    const { createLlmAdapter } =
      await import('@/shared/infrastructure/llm/createLlmAdapter')
    const { OpenRouterAdapter } =
      await import('@/shared/infrastructure/llm/OpenRouterAdapter')

    const adapter = createLlmAdapter()

    expect(adapter).toBeInstanceOf(OpenRouterAdapter)
  })

  it('returns GeminiAdapter when LLM_PROVIDER=gemini', async () => {
    setEnv('gemini')
    vi.doMock('@google/generative-ai', () => ({
      GoogleGenerativeAI: vi.fn(function () {
        return { getGenerativeModel: vi.fn() }
      }),
    }))
    const { createLlmAdapter } =
      await import('@/shared/infrastructure/llm/createLlmAdapter')
    const { GeminiAdapter } =
      await import('@/shared/infrastructure/llm/GeminiAdapter')

    const adapter = createLlmAdapter()

    expect(adapter).toBeInstanceOf(GeminiAdapter)
  })
})
