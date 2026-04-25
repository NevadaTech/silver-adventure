import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/core/shared/infrastructure/supabase/database.types'
import { SupabaseUserRepository } from '@/core/users/infrastructure/repositories/SupabaseUserRepository'

/**
 * Creates a mock Supabase client with chainable query builder.
 */
function createMockClient() {
  const mockOrder = vi.fn()
  const mockSingle = vi.fn()
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
  const mockSelect = vi.fn().mockReturnValue({ order: mockOrder, eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

  const client = { from: mockFrom } as unknown as SupabaseClient<Database>

  return { client, mockFrom, mockSelect, mockOrder, mockEq, mockSingle }
}

describe('SupabaseUserRepository', () => {
  let mocks: ReturnType<typeof createMockClient>
  let repository: SupabaseUserRepository

  beforeEach(() => {
    mocks = createMockClient()
    repository = new SupabaseUserRepository(mocks.client)
  })

  describe('findAll()', () => {
    it('returns mapped User entities on success', async () => {
      mocks.mockOrder.mockResolvedValueOnce({
        data: [
          { id: '1', name: 'Ted', created_at: '2026-01-01T00:00:00Z' },
          { id: '2', name: 'Ana', created_at: '2026-01-02T00:00:00Z' },
        ],
        error: null,
      })

      const users = await repository.findAll()

      expect(users).toHaveLength(2)
      expect(users[0].id).toBe('1')
      expect(users[0].name).toBe('Ted')
      expect(users[0].createdAt).toEqual(new Date('2026-01-01T00:00:00Z'))
      expect(users[1].id).toBe('2')
      expect(users[1].name).toBe('Ana')
    })

    it('throws when Supabase query fails', async () => {
      mocks.mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'Connection refused' },
      })

      await expect(repository.findAll()).rejects.toThrow(
        'Failed to fetch users: Connection refused',
      )
    })
  })

  describe('findById()', () => {
    it('returns a User entity when found', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: { id: '1', name: 'Ted', created_at: '2026-01-01T00:00:00Z' },
        error: null,
      })

      const user = await repository.findById('1')

      expect(user).not.toBeNull()
      expect(user!.id).toBe('1')
      expect(user!.name).toBe('Ted')
      expect(user!.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'))
      expect(mocks.mockEq).toHaveBeenCalledWith('id', '1')
    })

    it('returns null when user is not found (PGRST116)', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      })

      const user = await repository.findById('non-existent')

      expect(user).toBeNull()
    })

    it('throws on non-PGRST116 errors', async () => {
      mocks.mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST000', message: 'Internal error' },
      })

      await expect(repository.findById('1')).rejects.toThrow(
        'Failed to fetch user: Internal error',
      )
    })
  })
})
