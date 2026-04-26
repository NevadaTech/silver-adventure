import { Global, Module } from '@nestjs/common'
import {
  SupabaseClientProvider,
  SUPABASE_CLIENT,
} from './infrastructure/supabase/SupabaseClient'
import { GeminiAdapter } from './infrastructure/llm/GeminiAdapter'

export const LLM_PORT = Symbol('LLM_PORT')

@Global()
@Module({
  providers: [
    SupabaseClientProvider,
    { provide: LLM_PORT, useClass: GeminiAdapter },
  ],
  exports: [SUPABASE_CLIENT, LLM_PORT],
})
export class SharedModule {}
