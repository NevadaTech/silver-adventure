import { Global, Module } from '@nestjs/common'
import {
  SupabaseClientProvider,
  SUPABASE_CLIENT,
} from './infrastructure/supabase/SupabaseClient'
import { createLlmAdapter } from './infrastructure/llm/createLlmAdapter'

export const LLM_PORT = Symbol('LLM_PORT')

@Global()
@Module({
  providers: [
    SupabaseClientProvider,
    { provide: LLM_PORT, useFactory: createLlmAdapter },
  ],
  exports: [SUPABASE_CLIENT, LLM_PORT],
})
export class SharedModule {}
