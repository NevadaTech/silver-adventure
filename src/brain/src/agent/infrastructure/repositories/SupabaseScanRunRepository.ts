import { Inject, Injectable } from '@nestjs/common'
import { ScanRun } from '@/agent/domain/entities/ScanRun'
import type {
  ScanRunStatus,
  ScanRunTrigger,
} from '@/agent/domain/entities/ScanRun'
import type { ScanRunRepository } from '@/agent/domain/repositories/ScanRunRepository'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'scan_runs'

const STATUSES: ScanRunStatus[] = ['running', 'completed', 'failed', 'partial']
const TRIGGERS: ScanRunTrigger[] = ['cron', 'manual']

interface ScanRunRow {
  id: string
  started_at: string
  completed_at: string | null
  companies_scanned: number
  clusters_generated: number
  recommendations_generated: number
  events_emitted: number
  status: string
  trigger: string
  error_message: string | null
  duration_ms: number | null
}

@Injectable()
export class SupabaseScanRunRepository implements ScanRunRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async save(run: ScanRun): Promise<void> {
    const { error } = await this.db
      .from(TABLE)
      .upsert(this.toRow(run), { onConflict: 'id' })
    if (error) throw error
  }

  async findLatest(): Promise<ScanRun | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data as ScanRunRow) : null
  }

  async findLatestCompleted(): Promise<ScanRun | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data as ScanRunRow) : null
  }

  async countByStatus(status: ScanRunStatus): Promise<number> {
    const { error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    if (error) throw error
    return count ?? 0
  }

  private toRow(run: ScanRun): ScanRunRow {
    return {
      id: run.id,
      started_at: run.startedAt.toISOString(),
      completed_at: run.completedAt ? run.completedAt.toISOString() : null,
      companies_scanned: run.companiesScanned,
      clusters_generated: run.clustersGenerated,
      recommendations_generated: run.recommendationsGenerated,
      events_emitted: run.eventsEmitted,
      status: run.status,
      trigger: run.trigger,
      error_message: run.errorMessage,
      duration_ms: run.durationMs,
    }
  }

  private toEntity(row: ScanRunRow): ScanRun {
    if (!STATUSES.includes(row.status as ScanRunStatus)) {
      throw new Error(`Unknown ScanRun status from DB: ${row.status}`)
    }
    if (!TRIGGERS.includes(row.trigger as ScanRunTrigger)) {
      throw new Error(`Unknown ScanRun trigger from DB: ${row.trigger}`)
    }
    return ScanRun.hydrate({
      id: row.id,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      companiesScanned: row.companies_scanned,
      clustersGenerated: row.clusters_generated,
      recommendationsGenerated: row.recommendations_generated,
      eventsEmitted: row.events_emitted,
      status: row.status as ScanRunStatus,
      trigger: row.trigger as ScanRunTrigger,
      errorMessage: row.error_message,
    })
  }
}
