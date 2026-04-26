'use client'

import useSWR from 'swr'

import type {
  BrainAgentEvent,
  BrainAgentEventsResponse,
} from '@/core/shared/infrastructure/brain/brainClient'
import type { ConectorEvent } from '@/app/[locale]/app/_data/types'

import { mapBrainAgentEventToConectorEvent } from '../adapters/agent-event'

interface AgentEventsApiResponse extends BrainAgentEventsResponse {
  reason?: 'no_company' | null
}

export interface UseAgentEventsResult {
  events: ConectorEvent[] | undefined
  raw: BrainAgentEvent[] | undefined
  isLoading: boolean
  error: Error | undefined
  reason: 'no_company' | null
  unreadCount: number
}

export function useAgentEvents(): UseAgentEventsResult {
  const { data, error, isLoading } = useSWR<AgentEventsApiResponse>(
    '/api/me/events?limit=10',
    {
      revalidateOnFocus: false,
    },
  )

  return {
    events: data?.events.map(mapBrainAgentEventToConectorEvent),
    raw: data?.events,
    isLoading,
    error: error instanceof Error ? error : undefined,
    reason: data?.reason ?? null,
    unreadCount: data?.events.filter((e) => !e.read).length ?? 0,
  }
}
