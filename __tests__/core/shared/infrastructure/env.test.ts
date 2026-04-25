import { describe, it, expect } from 'vitest'

import { z } from 'zod'

/**
 * No importamos directamente desde env.ts porque el `export const env = parseEnv()`
 * se ejecuta al cargar el módulo y usa process.env (que no tiene las vars en test).
 *
 * En su lugar, re-definimos el schema acá para testear la validación pura,
 * y usamos dynamic imports con env vars pre-seteadas para testear parseEnv.
 */

// Recreamos el schema EXACTAMENTE como está en env.ts (single source of truth en prod,
// pero acá necesitamos testear la LÓGICA de validación, no el módulo en sí).
const envSchema = z.object({
  SUPABASE_URL: z.url({ error: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, { error: 'SUPABASE_PUBLISHABLE_KEY cannot be empty' }),
  DEBUG_ENABLED: z.enum(['true', 'false']).optional().default('false'),
})

describe('envSchema', () => {
  const validEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
  }

  it('should parse valid environment variables', () => {
    const result = envSchema.safeParse(validEnv)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.SUPABASE_URL).toBe('https://example.supabase.co')
      expect(result.data.SUPABASE_PUBLISHABLE_KEY).toBe('sb_publishable_abc123')
    }
  })

  it('should reject missing SUPABASE_URL', () => {
    const result = envSchema.safeParse({
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
    })

    expect(result.success).toBe(false)
  })

  it('should reject invalid URL for SUPABASE_URL', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      SUPABASE_URL: 'not-a-url',
    })

    expect(result.success).toBe(false)
  })

  it('should reject missing SUPABASE_PUBLISHABLE_KEY', () => {
    const result = envSchema.safeParse({
      SUPABASE_URL: 'https://example.supabase.co',
    })

    expect(result.success).toBe(false)
  })

  it('should reject empty SUPABASE_PUBLISHABLE_KEY', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      SUPABASE_PUBLISHABLE_KEY: '',
    })

    expect(result.success).toBe(false)
  })

  it('should ignore extra environment variables (passthrough)', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NODE_ENV: 'development',
      RANDOM_VAR: 'something',
    })

    expect(result.success).toBe(true)
  })

  it('should default DEBUG_ENABLED to "false" when omitted', () => {
    const result = envSchema.safeParse(validEnv)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.DEBUG_ENABLED).toBe('false')
    }
  })

  it('should accept DEBUG_ENABLED as "true"', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      DEBUG_ENABLED: 'true',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.DEBUG_ENABLED).toBe('true')
    }
  })

  it('should accept DEBUG_ENABLED as "false"', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      DEBUG_ENABLED: 'false',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.DEBUG_ENABLED).toBe('false')
    }
  })

  it('should reject invalid DEBUG_ENABLED values', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      DEBUG_ENABLED: 'yes',
    })

    expect(result.success).toBe(false)
  })
})

describe('parseEnv', () => {
  const validEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
  }

  it('should return typed env object for valid input', async () => {
    // Seteamos env vars ANTES de importar el módulo
    process.env.SUPABASE_URL = validEnv.SUPABASE_URL
    process.env.SUPABASE_PUBLISHABLE_KEY = validEnv.SUPABASE_PUBLISHABLE_KEY

    // Dynamic import — el módulo se evalúa con las env vars ya seteadas
    const { parseEnv } = await import('@/core/shared/infrastructure/env')

    const env = parseEnv(validEnv)

    expect(env.SUPABASE_URL).toBe('https://example.supabase.co')
    expect(env.SUPABASE_PUBLISHABLE_KEY).toBe('sb_publishable_abc123')

    // Cleanup
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_PUBLISHABLE_KEY
  })

  it('should throw with descriptive error for invalid input', async () => {
    process.env.SUPABASE_URL = validEnv.SUPABASE_URL
    process.env.SUPABASE_PUBLISHABLE_KEY = validEnv.SUPABASE_PUBLISHABLE_KEY

    const { parseEnv } = await import('@/core/shared/infrastructure/env')

    expect(() => parseEnv({})).toThrow('Invalid environment variables')

    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_PUBLISHABLE_KEY
  })

  it('should include variable name in error message', async () => {
    process.env.SUPABASE_URL = validEnv.SUPABASE_URL
    process.env.SUPABASE_PUBLISHABLE_KEY = validEnv.SUPABASE_PUBLISHABLE_KEY

    const { parseEnv } = await import('@/core/shared/infrastructure/env')

    expect(() => parseEnv({ SUPABASE_URL: 'https://valid.url' })).toThrow(
      'SUPABASE_PUBLISHABLE_KEY',
    )

    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_PUBLISHABLE_KEY
  })
})
