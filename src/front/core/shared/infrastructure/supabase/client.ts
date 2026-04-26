import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './database.types'

let instance: ReturnType<typeof createBrowserClient> | null = null

export function createSupabaseBrowserClient() {
  if (instance) return instance

  instance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )

  return instance
}
