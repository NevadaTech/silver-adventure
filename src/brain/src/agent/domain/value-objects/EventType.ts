export const EVENT_TYPES = [
  'new_high_score_match',
  'new_value_chain_partner',
  'new_cluster_member',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value)
}
