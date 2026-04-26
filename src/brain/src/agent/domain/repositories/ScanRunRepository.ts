import type { ScanRun, ScanRunStatus } from '@/agent/domain/entities/ScanRun'

export const SCAN_RUN_REPOSITORY = Symbol('SCAN_RUN_REPOSITORY')

export interface ScanRunRepository {
  save(run: ScanRun): Promise<void>
  findLatest(): Promise<ScanRun | null>
  findLatestCompleted(): Promise<ScanRun | null>
  countByStatus(status: ScanRunStatus): Promise<number>
}
