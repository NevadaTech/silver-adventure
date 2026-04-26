import { Inject, Injectable } from '@nestjs/common'
import { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'
import type { AiMatchCacheRepository } from '@/recommendations/domain/repositories/AiMatchCacheRepository'
import { isRelationType } from '@/recommendations/domain/value-objects/RelationType'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'ai_match_cache'

interface CacheRow {
  ciiu_origen: string
  ciiu_destino: string
  has_match: boolean
  relation_type: string | null
  confidence: number | null
  reason: string | null
  cached_at: string
  model_version: string | null
}

@Injectable()
export class SupabaseAiMatchCacheRepository implements AiMatchCacheRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async get(
    ciiuOrigen: string,
    ciiuDestino: string,
  ): Promise<AiMatchCacheEntry | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('ciiu_origen', ciiuOrigen)
      .eq('ciiu_destino', ciiuDestino)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data as CacheRow) : null
  }

  async put(entry: AiMatchCacheEntry): Promise<void> {
    const { error } = await this.db.from(TABLE).upsert(this.toRow(entry), {
      onConflict: 'ciiu_origen,ciiu_destino',
    })
    if (error) throw error
  }

  async size(): Promise<number> {
    const { error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  }

  async findAll(): Promise<AiMatchCacheEntry[]> {
    const { data, error } = await this.db.from(TABLE).select('*')
    if (error) throw error
    return ((data ?? []) as CacheRow[]).map((r) => this.toEntity(r))
  }

  private toEntity(row: CacheRow): AiMatchCacheEntry {
    if (row.relation_type !== null && !isRelationType(row.relation_type)) {
      throw new Error(
        `Unknown ai_match_cache relation_type from DB: ${row.relation_type}`,
      )
    }
    return AiMatchCacheEntry.create({
      ciiuOrigen: row.ciiu_origen,
      ciiuDestino: row.ciiu_destino,
      hasMatch: row.has_match,
      relationType: row.relation_type,
      confidence: row.confidence,
      reason: row.reason,
      cachedAt: new Date(row.cached_at),
      modelVersion: row.model_version,
    })
  }

  private toRow(entry: AiMatchCacheEntry): CacheRow {
    return {
      ciiu_origen: entry.ciiuOrigen,
      ciiu_destino: entry.ciiuDestino,
      has_match: entry.hasMatch,
      relation_type: entry.relationType,
      confidence: entry.confidence,
      reason: entry.reason,
      cached_at: entry.cachedAt.toISOString(),
      model_version: entry.modelVersion,
    }
  }
}
