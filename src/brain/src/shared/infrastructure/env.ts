import { z } from 'zod'

// Load .env from CWD before parsing. The brain runs under Node (via nest CLI),
// which does NOT auto-load .env files like Next.js / Bun do. In production,
// env vars are injected by the orchestrator and the file is absent — the
// catch keeps that path silent.
try {
  process.loadEnvFile()
} catch {
  // .env not present — fall back to process.env as-is
}

/**
 * Environment Variables Schema — Brain service
 *
 * Validación estricta con Zod. Se parsea UNA vez al levantar.
 * Si falta algo, el server explota inmediato con un mensaje claro.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  AGENT_CRON_SCHEDULE: z.string().min(1).default('*/60 * * * * *'),
  AGENT_ENABLED: z.enum(['true', 'false']).default('true'),
  AI_MATCH_INFERENCE_ENABLED: z.enum(['true', 'false']).default('true'),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-004'),
  GEMINI_CHAT_MODEL: z.string().min(1).default('gemini-2.5-flash'),

  GCP_PROJECT_ID: z.string().min(1).optional(),
  GCP_LOCATION: z.string().min(1).default('us-central1'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  BIGQUERY_DATASET: z.string().min(1).default('ruta_c'),

  DEBUG_ENABLED: z.enum(['true', 'false']).optional().default('false'),
})

export type Env = z.infer<typeof envSchema>

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

export const env = parseEnv()
