import { Provider } from '@nestjs/common'
import { PostgrestClient } from '@supabase/postgrest-js'
import { env } from '@/shared/infrastructure/env'
import type { Database } from './database.types'

export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT')

export type BrainSupabaseClient = PostgrestClient<Database>

export function createBrainSupabaseClient(): BrainSupabaseClient {
  return new PostgrestClient<Database>(`${env.SUPABASE_URL}/rest/v1`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
}

export const SupabaseClientProvider: Provider = {
  provide: SUPABASE_CLIENT,
  useFactory: () => createBrainSupabaseClient(),
}
