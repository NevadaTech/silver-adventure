import { Inject, Injectable, Logger } from '@nestjs/common'
import { AiMatchEngine } from '@/recommendations/application/services/AiMatchEngine'
import { AI_MATCH_CACHE_REPOSITORY } from '@/recommendations/domain/repositories/AiMatchCacheRepository'
import type { AiMatchCacheRepository } from '@/recommendations/domain/repositories/AiMatchCacheRepository'

export interface EvaluateAllStats {
  total: number
  cached: number
  evaluated: number
  errors: number
}

export interface EvaluateAllOptions {
  concurrency?: number
  onProgress?: (done: number, total: number) => void
}

@Injectable()
export class CiiuPairEvaluator {
  private readonly logger = new Logger(CiiuPairEvaluator.name)

  constructor(
    private readonly aiEngine: AiMatchEngine,
    @Inject(AI_MATCH_CACHE_REPOSITORY)
    private readonly cache: AiMatchCacheRepository,
  ) {}

  async evaluateAll(
    pairs: Set<string>,
    options: EvaluateAllOptions = {},
  ): Promise<EvaluateAllStats> {
    const concurrency = options.concurrency ?? 4
    const stats: EvaluateAllStats = {
      total: pairs.size,
      cached: 0,
      evaluated: 0,
      errors: 0,
    }
    const queue = Array.from(pairs)

    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const pair = queue.shift()
        if (!pair) break
        const [a, b] = pair.split('|')
        try {
          const existing = await this.cache.get(a, b)
          if (existing) {
            stats.cached++
          } else {
            await this.aiEngine.evaluate(a, b)
            stats.evaluated++
          }
        } catch (e) {
          stats.errors++
          const message = e instanceof Error ? e.message : String(e)
          this.logger.warn(`Failed to evaluate pair ${pair}: ${message}`)
        }
        options.onProgress?.(
          stats.cached + stats.evaluated + stats.errors,
          stats.total,
        )
      }
    })

    await Promise.all(workers)
    return stats
  }
}
