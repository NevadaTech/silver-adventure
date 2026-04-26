import { Inject, Injectable } from '@nestjs/common'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import type { RecommendationRepository } from '@/recommendations/domain/repositories/RecommendationRepository'
import {
  isRecommendationSource,
  type RecommendationSource,
} from '@/recommendations/domain/entities/Recommendation'
import {
  isRelationType,
  type RelationType,
} from '@/recommendations/domain/value-objects/RelationType'
import {
  Reasons,
  type Reason,
} from '@/recommendations/domain/value-objects/Reason'
import type { Json } from '@/shared/infrastructure/supabase/database.types'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'recommendations'
const CHUNK_SIZE = 500

interface RecommendationRow {
  id: string
  source_company_id: string
  target_company_id: string
  relation_type: string
  score: number
  reasons: Json
  source: string
  explanation: string | null
  explanation_cached_at: string | null
}

@Injectable()
export class SupabaseRecommendationRepository implements RecommendationRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async saveAll(recs: Recommendation[]): Promise<void> {
    if (recs.length === 0) return
    const rows = recs.map((r) => this.toRow(r))
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const { error } = await this.db
        .from(TABLE)
        .upsert(chunk, { onConflict: 'id' })
      if (error) throw error
    }
  }

  async findById(id: string): Promise<Recommendation | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data as RecommendationRow) : null
  }

  async findAll(): Promise<Recommendation[]> {
    const { data, error } = await this.db.from(TABLE).select('*')
    if (error) throw error
    return ((data ?? []) as RecommendationRow[]).map((r) => this.toEntity(r))
  }

  async snapshotKeys(): Promise<Set<string>> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('source_company_id, target_company_id, relation_type')
    if (error) throw error
    const keys = new Set<string>()
    for (const row of (data ?? []) as Array<{
      source_company_id: string
      target_company_id: string
      relation_type: string
    }>) {
      keys.add(
        `${row.source_company_id}|${row.target_company_id}|${row.relation_type}`,
      )
    }
    return keys
  }

  async findBySource(
    sourceId: string,
    limit?: number,
  ): Promise<Recommendation[]> {
    let query = this.db
      .from(TABLE)
      .select('*')
      .eq('source_company_id', sourceId)
      .order('score', { ascending: false })
    if (limit !== undefined) query = query.limit(limit)
    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as RecommendationRow[]).map((r) => this.toEntity(r))
  }

  async findBySourceAndType(
    sourceId: string,
    type: RelationType,
    limit?: number,
  ): Promise<Recommendation[]> {
    let query = this.db
      .from(TABLE)
      .select('*')
      .eq('source_company_id', sourceId)
      .eq('relation_type', type)
      .order('score', { ascending: false })
    if (limit !== undefined) query = query.limit(limit)
    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as RecommendationRow[]).map((r) => this.toEntity(r))
  }

  async updateExplanation(id: string, explanation: string): Promise<void> {
    const { error } = await this.db
      .from(TABLE)
      .update({
        explanation,
        explanation_cached_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
  }

  async countBySource(sourceId: string): Promise<number> {
    const { error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('source_company_id', sourceId)
    if (error) throw error
    return count ?? 0
  }

  async deleteAll(): Promise<void> {
    const { error } = await this.db.from(TABLE).delete().neq('id', '')
    if (error) throw error
  }

  private toEntity(row: RecommendationRow): Recommendation {
    if (!isRecommendationSource(row.source)) {
      throw new Error(`Unknown recommendation source from DB: ${row.source}`)
    }
    if (!isRelationType(row.relation_type)) {
      throw new Error(
        `Unknown recommendation relation_type from DB: ${row.relation_type}`,
      )
    }
    const reasons = Array.isArray(row.reasons)
      ? Reasons.from(row.reasons as unknown as Reason[])
      : Reasons.empty()

    return Recommendation.create({
      id: row.id,
      sourceCompanyId: row.source_company_id,
      targetCompanyId: row.target_company_id,
      relationType: row.relation_type,
      score: row.score,
      reasons,
      source: row.source as RecommendationSource,
      explanation: row.explanation,
      explanationCachedAt: row.explanation_cached_at
        ? new Date(row.explanation_cached_at)
        : null,
    })
  }

  private toRow(r: Recommendation): RecommendationRow {
    return {
      id: r.id,
      source_company_id: r.sourceCompanyId,
      target_company_id: r.targetCompanyId,
      relation_type: r.relationType,
      score: r.score,
      reasons: r.reasons.toJson() as unknown as Json,
      source: r.source,
      explanation: r.explanation,
      explanation_cached_at: r.explanationCachedAt
        ? r.explanationCachedAt.toISOString()
        : null,
    }
  }
}
