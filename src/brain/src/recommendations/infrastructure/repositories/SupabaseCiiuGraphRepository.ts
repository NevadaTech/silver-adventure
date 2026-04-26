import { Inject, Injectable } from '@nestjs/common'
import type { CiiuGraphPort } from '@/recommendations/domain/ports/CiiuGraphPort'
import { CIIU_GRAPH_PORT } from '@/recommendations/domain/ports/CiiuGraphPort'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import {
  isRelationType,
  type RelationType,
} from '@/recommendations/domain/value-objects/RelationType'
import {
  SUPABASE_CLIENT,
  type BrainSupabaseClient,
} from '@/shared/infrastructure/supabase/SupabaseClient'

// Re-export the token so module wiring can reference it from one place
export { CIIU_GRAPH_PORT }

interface CacheGraphRow {
  ciiu_origen: string
  ciiu_destino: string
  has_match: boolean
  relation_type: string | null
  confidence: number
  model_version: string | null
}

function toCiiuEdge(row: CacheGraphRow): CiiuEdge {
  if (row.relation_type !== null && !isRelationType(row.relation_type)) {
    throw new Error(
      `Unknown ai_match_cache relation_type from DB: ${row.relation_type}`,
    )
  }
  return CiiuEdge.create({
    ciiuOrigen: row.ciiu_origen,
    ciiuDestino: row.ciiu_destino,
    hasMatch: row.has_match,
    relationType: row.relation_type as RelationType | null,
    confidence: row.confidence,
    modelVersion: row.model_version,
  })
}

@Injectable()
export class SupabaseCiiuGraphRepository implements CiiuGraphPort {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async getMatchingPairs(
    threshold: number,
    relationTypes?: RelationType[],
  ): Promise<CiiuEdge[]> {
    let q = this.db
      .from('ai_match_cache')
      .select(
        'ciiu_origen,ciiu_destino,has_match,relation_type,confidence,model_version',
      )
      .eq('has_match', true)
      .gte('confidence', threshold)
      .neq('ciiu_destino', '*')

    if (relationTypes && relationTypes.length > 0) {
      q = q.in('relation_type', relationTypes)
    }

    const { data, error } = await q
    if (error) throw error
    return ((data ?? []) as CacheGraphRow[]).map(toCiiuEdge)
  }

  async getEdgesByOrigin(
    ciiuOrigen: string,
    threshold: number,
  ): Promise<CiiuEdge[]> {
    const { data, error } = await this.db
      .from('ai_match_cache')
      .select(
        'ciiu_origen,ciiu_destino,has_match,relation_type,confidence,model_version',
      )
      .eq('ciiu_origen', ciiuOrigen)
      .eq('has_match', true)
      .gte('confidence', threshold)
      .neq('ciiu_destino', '*')

    if (error) throw error
    return ((data ?? []) as CacheGraphRow[]).map(toCiiuEdge)
  }
}
