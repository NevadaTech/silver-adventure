'use client'

import useSWR from 'swr'

import type { BrainClusterMembersResponse } from '@/core/shared/infrastructure/brain/brainClient'
import { useCurrentUser } from '@/core/users/infrastructure/hooks/useCurrentUser'
import type { Cluster } from '@/app/[locale]/app/_data/types'

import { mapBrainClusterToCluster } from '../adapters/cluster'

interface MeClusterApiResponse {
  cluster: BrainClusterMembersResponse | null
  reason: 'no_company' | 'no_cluster' | null
}

export interface UseMiClusterResult {
  cluster: Cluster | undefined
  /** Raw payload exposed for callers that want extra metadata. */
  raw: BrainClusterMembersResponse | undefined
  isLoading: boolean
  error: Error | undefined
  reason: 'no_company' | 'no_cluster' | null
}

export function useMiCluster(): UseMiClusterResult {
  const { user } = useCurrentUser()
  const { data, error, isLoading } = useSWR<MeClusterApiResponse>(
    '/api/me/cluster',
    {
      revalidateOnFocus: false,
    },
  )

  const cluster = data?.cluster
    ? mapBrainClusterToCluster(data.cluster, user?.id ?? null)
    : undefined

  return {
    cluster,
    raw: data?.cluster ?? undefined,
    isLoading,
    error: error instanceof Error ? error : undefined,
    reason: data?.reason ?? null,
  }
}
