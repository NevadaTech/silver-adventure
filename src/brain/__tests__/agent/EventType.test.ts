import { describe, expect, it } from 'vitest'
import {
  EVENT_TYPES,
  isEventType,
} from '@/agent/domain/value-objects/EventType'

describe('EventType', () => {
  it('exposes the canonical event type literals', () => {
    expect(EVENT_TYPES).toEqual([
      'new_high_score_match',
      'new_value_chain_partner',
      'new_cluster_member',
      'joined_new_cluster',
      'etapa_changed',
    ])
  })

  it('isEventType returns true for valid values', () => {
    expect(isEventType('new_high_score_match')).toBe(true)
    expect(isEventType('new_value_chain_partner')).toBe(true)
    expect(isEventType('new_cluster_member')).toBe(true)
    expect(isEventType('joined_new_cluster')).toBe(true)
    expect(isEventType('etapa_changed')).toBe(true)
  })

  it('isEventType returns false for unknown values', () => {
    expect(isEventType('something_else')).toBe(false)
    expect(isEventType('')).toBe(false)
    expect(isEventType('NEW_HIGH_SCORE_MATCH')).toBe(false)
  })
})
