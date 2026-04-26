import { describe, it, expect } from 'vitest'
import { parseEnv } from '@/shared/infrastructure/env'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
}

describe('parseEnv — LLM provider selection', () => {
  it('defaults LLM_PROVIDER to "openrouter"', () => {
    const env = parseEnv({
      ...baseEnv,
      OPENROUTER_API_KEY: 'or-key',
    })
    expect(env.LLM_PROVIDER).toBe('openrouter')
  })

  it('defaults OPENROUTER_CHAT_MODEL to "google/gemma-4-31b-it:free"', () => {
    const env = parseEnv({
      ...baseEnv,
      OPENROUTER_API_KEY: 'or-key',
    })
    expect(env.OPENROUTER_CHAT_MODEL).toBe('google/gemma-4-31b-it:free')
  })

  it('defaults OPENROUTER_BASE_URL to OpenRouter v1', () => {
    const env = parseEnv({
      ...baseEnv,
      OPENROUTER_API_KEY: 'or-key',
    })
    expect(env.OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1')
  })

  it('accepts custom OPENROUTER_CHAT_MODEL', () => {
    const env = parseEnv({
      ...baseEnv,
      OPENROUTER_API_KEY: 'or-key',
      OPENROUTER_CHAT_MODEL: 'deepseek/deepseek-chat-v3.1:free',
    })
    expect(env.OPENROUTER_CHAT_MODEL).toBe('deepseek/deepseek-chat-v3.1:free')
  })

  it('accepts optional OPENROUTER_APP_URL and OPENROUTER_APP_NAME', () => {
    const env = parseEnv({
      ...baseEnv,
      OPENROUTER_API_KEY: 'or-key',
      OPENROUTER_APP_URL: 'https://silveradventure.app',
      OPENROUTER_APP_NAME: 'Silver Adventure',
    })
    expect(env.OPENROUTER_APP_URL).toBe('https://silveradventure.app')
    expect(env.OPENROUTER_APP_NAME).toBe('Silver Adventure')
  })

  it('OPENROUTER_APP_URL and OPENROUTER_APP_NAME are optional', () => {
    const env = parseEnv({
      ...baseEnv,
      OPENROUTER_API_KEY: 'or-key',
    })
    expect(env.OPENROUTER_APP_URL).toBeUndefined()
    expect(env.OPENROUTER_APP_NAME).toBeUndefined()
  })

  it('rejects when LLM_PROVIDER=openrouter but OPENROUTER_API_KEY is missing', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        LLM_PROVIDER: 'openrouter',
      }),
    ).toThrow(/OPENROUTER_API_KEY/)
  })

  it('rejects when LLM_PROVIDER=gemini but GEMINI_API_KEY is missing', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        LLM_PROVIDER: 'gemini',
      }),
    ).toThrow(/GEMINI_API_KEY/)
  })

  it('accepts LLM_PROVIDER=gemini with GEMINI_API_KEY present', () => {
    const env = parseEnv({
      ...baseEnv,
      LLM_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'gem-key',
    })
    expect(env.LLM_PROVIDER).toBe('gemini')
  })

  it('rejects invalid LLM_PROVIDER values', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        LLM_PROVIDER: 'cohere',
        OPENROUTER_API_KEY: 'or-key',
      }),
    ).toThrow()
  })
})
