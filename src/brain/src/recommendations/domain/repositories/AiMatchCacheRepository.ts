import type { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'

export const AI_MATCH_CACHE_REPOSITORY = Symbol('AI_MATCH_CACHE_REPOSITORY')

export interface AiMatchCacheRepository {
  get(
    ciiuOrigen: string,
    ciiuDestino: string,
  ): Promise<AiMatchCacheEntry | null>
  put(entry: AiMatchCacheEntry): Promise<void>
  size(): Promise<number>
  findAll(): Promise<AiMatchCacheEntry[]>
}
