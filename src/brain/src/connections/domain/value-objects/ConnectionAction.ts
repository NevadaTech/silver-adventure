export const CONNECTION_ACTIONS = [
  'marked',
  'saved',
  'dismissed',
  'simulated_contact',
] as const

export type ConnectionAction = (typeof CONNECTION_ACTIONS)[number]

export function isConnectionAction(value: string): value is ConnectionAction {
  return (CONNECTION_ACTIONS as readonly string[]).includes(value)
}
