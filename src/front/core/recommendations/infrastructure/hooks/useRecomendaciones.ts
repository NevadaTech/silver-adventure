'use client'

import useSWR from 'swr'
import type { Recomendacion } from '@/app/[locale]/app/_data/types'

export interface RecomendacionesResponse {
  recomendaciones: Recomendacion[]
  partial: boolean
  reason: string | null
}

interface UseRecomendacionesResult {
  data: Recomendacion[] | undefined
  partial: boolean
  isLoading: boolean
  error: Error | undefined
  reason: string | null
}

export function useRecomendaciones(): UseRecomendacionesResult {
  const { data, error, isLoading } = useSWR<RecomendacionesResponse>(
    '/api/me/recommendations/grouped',
  )

  return {
    data: data?.recomendaciones,
    partial: data?.partial ?? true,
    isLoading,
    error: error instanceof Error ? error : undefined,
    reason: data?.reason ?? null,
  }
}
