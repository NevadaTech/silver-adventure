'use client'

import { useState, useTransition } from 'react'
import { useSWRConfig } from 'swr'

import { httpClient } from '@/core/shared/infrastructure/http/httpClient'

import type { ConnectionAction } from '../adapters/connection'

interface UseRecommendationActionResult {
  apply: (recId: string, action: ConnectionAction) => Promise<void>
  remove: (recId: string, action: ConnectionAction) => Promise<void>
  isPending: boolean
  error: Error | null
}

/**
 * Mutación de acción del usuario sobre una recomendación.
 *
 * Después de cada apply/remove invalidamos `/api/me/connections` para que
 * la página de Conexiones se refresque automáticamente. La UI optimista
 * vive en el componente que renderiza el botón (no acá) para mantener el
 * hook simple y reusable.
 */
export function useRecommendationAction(): UseRecommendationActionResult {
  const { mutate } = useSWRConfig()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<Error | null>(null)

  function run(fn: () => Promise<unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      startTransition(async () => {
        try {
          await fn()
          await mutate('/api/me/connections')
          setError(null)
          resolve()
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err))
          setError(e)
          reject(e)
        }
      })
    })
  }

  async function apply(recId: string, action: ConnectionAction): Promise<void> {
    return run(async () => {
      await httpClient.post(
        `/api/me/recommendations/${encodeURIComponent(recId)}/actions`,
        {
          action,
        },
      )
    })
  }

  async function remove(
    recId: string,
    action: ConnectionAction,
  ): Promise<void> {
    return run(async () => {
      await httpClient.delete(
        `/api/me/recommendations/${encodeURIComponent(recId)}/actions?action=${action}`,
      )
    })
  }

  return { apply, remove, isPending, error }
}
