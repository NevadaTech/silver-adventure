import { beforeEach, describe, expect, it } from 'vitest'
import { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'
import { InMemoryAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository'

describe('InMemoryAiMatchCacheRepository', () => {
  let repo: InMemoryAiMatchCacheRepository

  beforeEach(() => {
    repo = new InMemoryAiMatchCacheRepository()
  })

  it('returns null when entry is missing', async () => {
    expect(await repo.get('0122', '4631')).toBeNull()
  })

  it('puts and gets entries by composite key', async () => {
    const entry = AiMatchCacheEntry.create({
      ciiuOrigen: '0122',
      ciiuDestino: '4631',
      hasMatch: true,
      relationType: 'cliente',
      confidence: 0.9,
    })
    await repo.put(entry)

    const got = await repo.get('0122', '4631')
    expect(got).not.toBeNull()
    expect(got!.confidence).toBe(0.9)
  })

  it('treats different directions as different entries', async () => {
    await repo.put(
      AiMatchCacheEntry.create({
        ciiuOrigen: '0122',
        ciiuDestino: '4631',
        hasMatch: true,
        relationType: 'cliente',
      }),
    )
    expect(await repo.get('4631', '0122')).toBeNull()
  })

  it('overwrites entries with the same composite key', async () => {
    await repo.put(
      AiMatchCacheEntry.create({
        ciiuOrigen: '0122',
        ciiuDestino: '4631',
        hasMatch: false,
      }),
    )
    await repo.put(
      AiMatchCacheEntry.create({
        ciiuOrigen: '0122',
        ciiuDestino: '4631',
        hasMatch: true,
        relationType: 'cliente',
        confidence: 0.7,
      }),
    )

    const got = await repo.get('0122', '4631')
    expect(got!.hasMatch).toBe(true)
    expect(got!.confidence).toBe(0.7)
    expect(await repo.size()).toBe(1)
  })

  it('size returns the total number of entries', async () => {
    expect(await repo.size()).toBe(0)
    await repo.put(
      AiMatchCacheEntry.create({
        ciiuOrigen: '0122',
        ciiuDestino: '4631',
        hasMatch: false,
      }),
    )
    await repo.put(
      AiMatchCacheEntry.create({
        ciiuOrigen: '0123',
        ciiuDestino: '4631',
        hasMatch: false,
      }),
    )
    expect(await repo.size()).toBe(2)
  })
})
