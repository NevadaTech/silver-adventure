import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { HealthController } from '@/shared/infrastructure/health/health.controller'

describe('HealthController', () => {
  it('returns ok status with a timestamp', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile()

    const controller = moduleRef.get(HealthController)
    const result = controller.check()

    expect(result.status).toBe('ok')
    expect(result.timestamp).toBeDefined()
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date')
  })
})
