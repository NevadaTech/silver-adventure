import { Global, Module } from '@nestjs/common'
import {
  SupabaseClientProvider,
  SUPABASE_CLIENT,
} from './infrastructure/supabase/SupabaseClient'
import { GeminiAdapter } from './infrastructure/gemini/GeminiAdapter'

export const GEMINI_PORT = Symbol('GEMINI_PORT')

@Global()
@Module({
  providers: [
    SupabaseClientProvider,
    { provide: GEMINI_PORT, useClass: GeminiAdapter },
  ],
  exports: [SUPABASE_CLIENT, GEMINI_PORT],
})
export class SharedModule {}
