import { Injectable } from '@nestjs/common'
import type { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'
import type { AiMatchCacheRepository } from '@/recommendations/domain/repositories/AiMatchCacheRepository'

@Injectable()
export class InMemoryAiMatchCacheRepository implements AiMatchCacheRepository {
  private readonly store = new Map<string, AiMatchCacheEntry>()

  async get(
    ciiuOrigen: string,
    ciiuDestino: string,
  ): Promise<AiMatchCacheEntry | null> {
    return this.store.get(this.keyOf(ciiuOrigen, ciiuDestino)) ?? null
  }

  async put(entry: AiMatchCacheEntry): Promise<void> {
    this.store.set(entry.key, entry)
  }

  async size(): Promise<number> {
    return this.store.size
  }

  async findAll(): Promise<AiMatchCacheEntry[]> {
    return Array.from(this.store.values())
  }

  private keyOf(origen: string, destino: string): string {
    return `${origen}->${destino}`
  }
}
