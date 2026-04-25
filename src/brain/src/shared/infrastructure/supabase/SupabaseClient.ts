import { Provider } from '@nestjs/common'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/shared/infrastructure/env'
import type { Database } from './database.types'

export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT')

export type BrainSupabaseClient = SupabaseClient<Database>

export function createBrainSupabaseClient(): BrainSupabaseClient {
  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export const SupabaseClientProvider: Provider = {
  provide: SUPABASE_CLIENT,
  useFactory: () => createBrainSupabaseClient(),
}
