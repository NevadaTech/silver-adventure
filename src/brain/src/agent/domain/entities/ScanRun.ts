import { Entity } from '@/shared/domain/Entity'

export type ScanRunStatus = 'running' | 'completed' | 'failed' | 'partial'
export type ScanRunTrigger = 'cron' | 'manual'

export interface ScanRunStats {
  companiesScanned: number
  clustersGenerated: number
  recommendationsGenerated: number
  eventsEmitted: number
}

interface ScanRunProps {
  startedAt: Date
  completedAt: Date | null
  companiesScanned: number
  clustersGenerated: number
  recommendationsGenerated: number
  eventsEmitted: number
  status: ScanRunStatus
  trigger: ScanRunTrigger
  errorMessage: string | null
}

export interface StartScanRunInput {
  id: string
  trigger: ScanRunTrigger
  now: Date
}

export interface HydrateScanRunInput extends ScanRunProps {
  id: string
}

export class ScanRun extends Entity<string> {
  private readonly props: ScanRunProps

  private constructor(id: string, props: ScanRunProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static start(input: StartScanRunInput): ScanRun {
    const id = input.id?.trim() ?? ''
    if (id.length === 0) {
      throw new Error('ScanRun.id cannot be empty')
    }
    return new ScanRun(id, {
      startedAt: input.now,
      completedAt: null,
      companiesScanned: 0,
      clustersGenerated: 0,
      recommendationsGenerated: 0,
      eventsEmitted: 0,
      status: 'running',
      trigger: input.trigger,
      errorMessage: null,
    })
  }

  static hydrate(input: HydrateScanRunInput): ScanRun {
    const id = input.id?.trim() ?? ''
    if (id.length === 0) {
      throw new Error('ScanRun.id cannot be empty')
    }
    const { id: _id, ...props } = input
    return new ScanRun(id, props)
  }

  complete(stats: ScanRunStats, now: Date): ScanRun {
    ScanRun.assertStats(stats)
    return new ScanRun(this.id, {
      ...this.props,
      ...stats,
      completedAt: now,
      status: 'completed',
      errorMessage: null,
    })
  }

  fail(message: string, now: Date): ScanRun {
    const trimmed = message?.trim() ?? ''
    if (trimmed.length === 0) {
      throw new Error('ScanRun.fail message cannot be empty')
    }
    return new ScanRun(this.id, {
      ...this.props,
      completedAt: now,
      status: 'failed',
      errorMessage: trimmed,
    })
  }

  partial(stats: ScanRunStats, message: string, now: Date): ScanRun {
    ScanRun.assertStats(stats)
    const trimmed = message?.trim() ?? ''
    if (trimmed.length === 0) {
      throw new Error('ScanRun.partial message cannot be empty')
    }
    return new ScanRun(this.id, {
      ...this.props,
      ...stats,
      completedAt: now,
      status: 'partial',
      errorMessage: trimmed,
    })
  }

  private static assertStats(stats: ScanRunStats): void {
    if (
      stats.companiesScanned < 0 ||
      stats.clustersGenerated < 0 ||
      stats.recommendationsGenerated < 0 ||
      stats.eventsEmitted < 0
    ) {
      throw new Error('ScanRun stats must be non-negative')
    }
  }

  get startedAt(): Date {
    return this.props.startedAt
  }
  get completedAt(): Date | null {
    return this.props.completedAt
  }
  get companiesScanned(): number {
    return this.props.companiesScanned
  }
  get clustersGenerated(): number {
    return this.props.clustersGenerated
  }
  get recommendationsGenerated(): number {
    return this.props.recommendationsGenerated
  }
  get eventsEmitted(): number {
    return this.props.eventsEmitted
  }
  get status(): ScanRunStatus {
    return this.props.status
  }
  get trigger(): ScanRunTrigger {
    return this.props.trigger
  }
  get errorMessage(): string | null {
    return this.props.errorMessage
  }
  get durationMs(): number | null {
    if (!this.props.completedAt) return null
    return this.props.completedAt.getTime() - this.props.startedAt.getTime()
  }
}
