import type { LlmPort } from '@/shared/domain/LlmPort'
import { env } from '@/shared/infrastructure/env'
import { GeminiAdapter } from '@/shared/infrastructure/llm/GeminiAdapter'
import { OpenRouterAdapter } from '@/shared/infrastructure/llm/OpenRouterAdapter'

export function createLlmAdapter(): LlmPort {
  switch (env.LLM_PROVIDER) {
    case 'openrouter':
      return new OpenRouterAdapter()
    case 'gemini':
      return new GeminiAdapter()
  }
}
