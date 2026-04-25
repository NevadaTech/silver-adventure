import { z } from 'zod'

/**
 * Environment Variables Schema
 *
 * Validación estricta de las env vars del servidor con Zod.
 * Se parsea UNA vez al levantar — si falta algo, explota inmediato
 * con un mensaje claro en vez de un error críptico en runtime.
 *
 * NINGUNA variable lleva NEXT_PUBLIC_ porque todo corre server-side (BFF).
 */
export const envSchema = z.object({
  SUPABASE_URL: z.url({ error: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, { error: 'SUPABASE_PUBLISHABLE_KEY cannot be empty' }),
  /**
   * Habilita logging detallado en server-side.
   * Opcional — si no está definido, el logger queda deshabilitado (NullLogger).
   * Valores válidos: "true" | "false" (cualquier otro valor = false).
   */
  DEBUG_ENABLED: z.enum(['true', 'false']).optional().default('false'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Parsea y valida las env vars. Exportada para testabilidad.
 *
 * En producción se llama automáticamente al importar `env`.
 * En tests podés llamarla directamente pasando `process.env` mockeado.
 */
export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `❌ Invalid environment variables:\n${formatted}\n\n` +
        'Check your .env file matches .env.example',
    )
  }

  return result.data
}

/**
 * Parsed & validated env singleton — import this, NOT process.env directamente.
 */
export const env = parseEnv()
