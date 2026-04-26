// NestJS reads constructor paramtypes via emitDecoratorMetadata at runtime.
// Class deps without @Inject() must keep their value-imports — `import type`
// would erase the binding and break DI.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { RunIncrementalScan } from '@/agent/application/use-cases/RunIncrementalScan'
import { env } from '@/shared/infrastructure/env'

@Injectable()
export class AgentScheduler {
  private readonly logger = new Logger(AgentScheduler.name)
  private isRunning = false

  constructor(private readonly runScan: RunIncrementalScan) {}

  @Cron(env.AGENT_CRON_SCHEDULE, { name: 'agent-incremental-scan' })
  async handleScan(): Promise<void> {
    if (env.AGENT_ENABLED === 'false') return
    if (this.isRunning) {
      this.logger.warn('Previous scan still running, skipping this tick')
      return
    }

    this.isRunning = true
    const t0 = Date.now()
    try {
      const result = await this.runScan.execute({ trigger: 'cron' })
      const dt = Date.now() - t0
      this.logger.log(`Scan completed in ${dt}ms: ${JSON.stringify(result)}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const stack = e instanceof Error ? e.stack : undefined
      this.logger.error(`Scan failed: ${message}`, stack)
    } finally {
      this.isRunning = false
    }
  }
}
