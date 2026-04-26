'use client'

import useSWR from 'swr'

import type { BrainUserConnectionsResponse } from '@/core/shared/infrastructure/brain/brainClient'
import {
  mapBrainConnectionsToConexiones,
  type ConnectionAction,
} from '@/core/connections/infrastructure/adapters/connection'
import type { Conexion } from '@/app/[locale]/app/_data/types'

export interface UseUserConnectionsResult {
  data: Conexion[] | undefined
  raw: BrainUserConnectionsResponse | undefined
  isLoading: boolean
  error: Error | undefined
  /**
   * Returns the raw set of `(recommendationId, action)` pairs already
   * recorded by the user, so components can highlight buttons that are
   * already pressed without re-deriving the relationship from `Conexion`.
   */
  isApplied: (recId: string, action: ConnectionAction) => boolean
}

export function useUserConnections(): UseUserConnectionsResult {
  const { data, error, isLoading } = useSWR<BrainUserConnectionsResponse>(
    '/api/me/connections',
    {
      revalidateOnFocus: false,
    },
  )

  const conexiones = data
    ? mapBrainConnectionsToConexiones(data.connections)
    : undefined

  function isApplied(recId: string, action: ConnectionAction): boolean {
    if (!data) return false
    return data.connections.some(
      (c) => c.recommendationId === recId && c.action === action,
    )
  }

  return {
    data: conexiones,
    raw: data,
    isLoading,
    error: error instanceof Error ? error : undefined,
    isApplied,
  }
}
