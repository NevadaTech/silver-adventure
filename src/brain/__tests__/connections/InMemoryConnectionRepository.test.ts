import { beforeEach, describe, expect, it } from 'vitest'
import { Connection } from '@/connections/domain/entities/Connection'
import { InMemoryConnectionRepository } from '@/connections/infrastructure/repositories/InMemoryConnectionRepository'

const makeConnection = (
  overrides: Partial<{
    id: string
    userId: string
    recommendationId: string
    action: 'marked' | 'saved' | 'dismissed' | 'simulated_contact'
    createdAt: Date
  }> = {},
): Connection =>
  Connection.create({
    id: overrides.id ?? 'conn-1',
    userId: overrides.userId ?? 'u-1',
    recommendationId: overrides.recommendationId ?? 'rec-1',
    action: overrides.action ?? 'saved',
    createdAt: overrides.createdAt,
  })

describe('InMemoryConnectionRepository', () => {
  let repo: InMemoryConnectionRepository

  beforeEach(() => {
    repo = new InMemoryConnectionRepository()
  })

  it('upsert persists a new connection and returns it', async () => {
    const c = makeConnection()
    const saved = await repo.upsert(c)
    expect(saved).toBe(c)
    expect(await repo.findByUser('u-1')).toHaveLength(1)
  })

  it('upsert replaces an existing connection on the same key', async () => {
    const a = makeConnection({
      id: 'conn-a',
      createdAt: new Date('2026-01-01'),
    })
    const b = makeConnection({
      id: 'conn-b',
      createdAt: new Date('2026-04-01'),
    })

    await repo.upsert(a)
    await repo.upsert(b)

    const all = await repo.findByUser('u-1')
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('conn-b')
  })

  it('findByUser returns connections sorted by createdAt desc', async () => {
    await repo.upsert(
      makeConnection({
        id: 'older',
        action: 'saved',
        createdAt: new Date('2026-01-01'),
      }),
    )
    await repo.upsert(
      makeConnection({
        id: 'newer',
        action: 'marked',
        createdAt: new Date('2026-04-01'),
      }),
    )

    const result = await repo.findByUser('u-1')
    expect(result.map((c) => c.id)).toEqual(['newer', 'older'])
  })

  it('findByUser scopes results to the requested user', async () => {
    await repo.upsert(makeConnection({ userId: 'u-1' }))
    await repo.upsert(
      makeConnection({
        id: 'conn-2',
        userId: 'u-2',
        recommendationId: 'rec-2',
      }),
    )

    expect(await repo.findByUser('u-1')).toHaveLength(1)
    expect(await repo.findByUser('u-2')).toHaveLength(1)
    expect(await repo.findByUser('missing')).toEqual([])
  })

  it('findByUserAndRecommendation returns every action recorded on the rec', async () => {
    await repo.upsert(makeConnection({ id: 'a', action: 'saved' }))
    await repo.upsert(makeConnection({ id: 'b', action: 'simulated_contact' }))
    await repo.upsert(
      makeConnection({
        id: 'c',
        action: 'marked',
        recommendationId: 'rec-other',
      }),
    )

    const matched = await repo.findByUserAndRecommendation('u-1', 'rec-1')
    expect(matched.map((c) => c.action).sort()).toEqual([
      'saved',
      'simulated_contact',
    ])
  })

  it('delete removes only the matching (user, rec, action) tuple', async () => {
    await repo.upsert(makeConnection({ id: 'a', action: 'saved' }))
    await repo.upsert(makeConnection({ id: 'b', action: 'marked' }))

    await repo.delete('u-1', 'rec-1', 'saved')

    const remaining = await repo.findByUser('u-1')
    expect(remaining.map((c) => c.action)).toEqual(['marked'])
  })

  it('delete is a no-op when nothing matches', async () => {
    await expect(
      repo.delete('u-missing', 'rec-missing', 'saved'),
    ).resolves.toBeUndefined()
  })
})
