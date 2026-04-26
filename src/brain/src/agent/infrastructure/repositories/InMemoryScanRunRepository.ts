import { Injectable } from '@nestjs/common'
import type { ScanRun, ScanRunStatus } from '@/agent/domain/entities/ScanRun'
import type { ScanRunRepository } from '@/agent/domain/repositories/ScanRunRepository'

@Injectable()
export class InMemoryScanRunRepository implements ScanRunRepository {
  private readonly store = new Map<string, ScanRun>()

  async save(run: ScanRun): Promise<void> {
    this.store.set(run.id, run)
  }

  async findLatest(): Promise<ScanRun | null> {
    const all = Array.from(this.store.values())
    if (all.length === 0) return null
    return all.reduce((acc, r) =>
      r.startedAt.getTime() > acc.startedAt.getTime() ? r : acc,
    )
  }

  async findLatestCompleted(): Promise<ScanRun | null> {
    const completed = Array.from(this.store.values()).filter(
      (r) => r.status === 'completed',
    )
    if (completed.length === 0) return null
    return completed.reduce((acc, r) =>
      (r.completedAt?.getTime() ?? 0) > (acc.completedAt?.getTime() ?? 0)
        ? r
        : acc,
    )
  }

  async countByStatus(status: ScanRunStatus): Promise<number> {
    let n = 0
    for (const r of this.store.values()) {
      if (r.status === status) n++
    }
    return n
  }
}
