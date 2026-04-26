import { describe, expect, it } from 'vitest'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'

const T0 = new Date('2026-04-26T10:00:00Z')

describe('AgentEvent', () => {
  describe('create', () => {
    it('creates an unread event with the provided createdAt', () => {
      const ev = AgentEvent.create({
        id: 'ev-1',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: { recommendationId: 'r-1', score: 0.9 },
        now: T0,
      })

      expect(ev.id).toBe('ev-1')
      expect(ev.companyId).toBe('c-1')
      expect(ev.eventType).toBe('new_high_score_match')
      expect(ev.payload).toEqual({ recommendationId: 'r-1', score: 0.9 })
      expect(ev.read).toBe(false)
      expect(ev.createdAt).toEqual(T0)
    })

    it('rejects empty id', () => {
      expect(() =>
        AgentEvent.create({
          id: '',
          companyId: 'c-1',
          eventType: 'new_cluster_member',
          payload: {},
          now: T0,
        }),
      ).toThrow(/id cannot be empty/)
    })

    it('rejects empty companyId', () => {
      expect(() =>
        AgentEvent.create({
          id: 'ev-1',
          companyId: '   ',
          eventType: 'new_cluster_member',
          payload: {},
          now: T0,
        }),
      ).toThrow(/companyId cannot be empty/)
    })

    it('accepts an empty payload object', () => {
      const ev = AgentEvent.create({
        id: 'ev-1',
        companyId: 'c-1',
        eventType: 'new_cluster_member',
        payload: {},
        now: T0,
      })
      expect(ev.payload).toEqual({})
    })
  })

  describe('markAsRead', () => {
    it('returns a new instance with read=true', () => {
      const ev = AgentEvent.create({
        id: 'ev-1',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: { score: 0.9 },
        now: T0,
      })

      const read = ev.markAsRead()

      expect(read).not.toBe(ev)
      expect(read.read).toBe(true)
      expect(ev.read).toBe(false)
    })

    it('preserves payload, eventType, companyId, createdAt', () => {
      const ev = AgentEvent.create({
        id: 'ev-1',
        companyId: 'c-1',
        eventType: 'new_value_chain_partner',
        payload: { foo: 'bar' },
        now: T0,
      })
      const read = ev.markAsRead()

      expect(read.companyId).toBe('c-1')
      expect(read.eventType).toBe('new_value_chain_partner')
      expect(read.payload).toEqual({ foo: 'bar' })
      expect(read.createdAt).toEqual(ev.createdAt)
    })
  })

  describe('hydrate', () => {
    it('rebuilds an instance from stored props', () => {
      const ev = AgentEvent.hydrate({
        id: 'ev-1',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: { score: 0.9 },
        read: true,
        createdAt: new Date('2026-04-25T08:00:00Z'),
      })

      expect(ev.id).toBe('ev-1')
      expect(ev.read).toBe(true)
      expect(ev.createdAt).toEqual(new Date('2026-04-25T08:00:00Z'))
    })
  })
})
