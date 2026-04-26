import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'
import { SupabaseAuthRepository } from './SupabaseAuthRepository'

const supabase = createSupabaseServerClient()
export const authStore = new SupabaseAuthRepository(supabase)
