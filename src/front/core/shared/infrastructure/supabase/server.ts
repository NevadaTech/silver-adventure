import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { env } from '@/core/shared/infrastructure/env'

import type { Database } from './database.types'

/**
 * Supabase Server Client — BFF Only
 *
 * Este cliente solo vive en el server. El import 'server-only' garantiza
 * que si alguien intenta importarlo desde un Client Component, explota en build.
 *
 * Las env vars vienen pre-validadas por Zod desde `env` — si faltan
 * o son inválidas, el error ya explotó al levantar el server.
 *
 * NO usa cookies ni auth — es un cliente directo con la publishable key.
 * Para auth con sesiones, usarías createServerClient de @supabase/ssr.
 */
export function createSupabaseServerClient() {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY)
}
