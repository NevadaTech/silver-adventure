import { z } from 'zod'

/**
 * Environment Variables Schema — Brain service
 *
 * Validación estricta con Zod. Se parsea UNA vez al levantar.
 * Si falta algo, el server explota inmediato con un mensaje claro.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),

  GCP_PROJECT_ID: z.string().min(1).optional(),
  GCP_LOCATION: z.string().min(1).default('us-central1'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  BIGQUERY_DATASET: z.string().min(1).default('ruta_c'),

  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-004'),
  GEMINI_CHAT_MODEL: z.string().min(1).default('gemini-2.5-flash'),

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
