import { z } from 'zod'

/**
 * Environment Variables Schema
 *
 * Validación estricta de las env vars del servidor con Zod.
 * Se parsea UNA vez al levantar — si falta algo, explota inmediato
 * con un mensaje claro en vez de un error críptico en runtime.
 *
 * Casi todas son server-only (BFF). Las únicas excepciones `NEXT_PUBLIC_`
 * están documentadas en AGENTS.md sección 8.3 — todas son no-secretos
 * (URLs, flags, publishable keys diseñadas para vivir en el cliente).
 */
export const envSchema = z.object({
  SUPABASE_URL: z.url({ error: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, { error: 'SUPABASE_PUBLISHABLE_KEY cannot be empty' }),
  /**
   * Mismo valor que SUPABASE_URL pero con prefijo NEXT_PUBLIC_ para que
   * Next.js lo inline en el bundle del browser. Necesario para que
   * `createSupabaseBrowserClient` (cliente del lado del navegador) pueda
   * gestionar la sesión de auth (setSession, refresh, signOut).
   * NO es secreto — es la URL pública del proyecto Supabase.
   */
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL',
  }),
  /**
   * Mismo valor que SUPABASE_PUBLISHABLE_KEY pero con prefijo NEXT_PUBLIC_.
   * NO es secreto — la "publishable key" de Supabase está diseñada para
   * vivir en el cliente. RLS es lo que protege la data.
   */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, {
    error: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY cannot be empty',
  }),
  /**
   * Habilita logging detallado en server-side.
   * Opcional — si no está definido, el logger queda deshabilitado (NullLogger).
   * Valores válidos: "true" | "false" (cualquier otro valor = false).
   */
  DEBUG_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  /**
   * Base URL del backend NestJS (brain). El front lo invoca server-side
   * para clasificación CIIU, generación de clusters y recomendaciones.
   * Default razonable para dev local — en prod debe venir del entorno.
   */
  BRAIN_API_URL: z
    .url({ error: 'BRAIN_API_URL must be a valid URL' })
    .optional()
    .default('http://localhost:3001'),
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
