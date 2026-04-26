import { describe, expect, it } from 'vitest'
import {
  EVENT_TYPES,
  isEventType,
} from '@/agent/domain/value-objects/EventType'

describe('EventType', () => {
  it('exposes the three event type literals', () => {
    expect(EVENT_TYPES).toEqual([
      'new_high_score_match',
      'new_value_chain_partner',
      'new_cluster_member',
    ])
  })

  it('isEventType returns true for valid values', () => {
    expect(isEventType('new_high_score_match')).toBe(true)
    expect(isEventType('new_value_chain_partner')).toBe(true)
    expect(isEventType('new_cluster_member')).toBe(true)
  })

  it('isEventType returns false for unknown values', () => {
    expect(isEventType('something_else')).toBe(false)
    expect(isEventType('')).toBe(false)
    expect(isEventType('NEW_HIGH_SCORE_MATCH')).toBe(false)
  })
})
