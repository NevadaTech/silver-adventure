'use client'

import { useTranslations } from 'next-intl'

import { useCurrentUser } from '@/core/users/infrastructure/hooks/useCurrentUser'
import { useRecomendaciones } from '@/core/recommendations/infrastructure/hooks/useRecomendaciones'

/**
 * Encabezado de la página de recomendaciones — client side para poder leer
 * el conteo real de recos (SWR) y el nombre del negocio del usuario logueado
 * sin depender de mocks.
 */
export function RecoHeader() {
  const t = useTranslations('App.Recomendaciones')
  const { data: recos, isLoading: isLoadingRecos } = useRecomendaciones()
  const { user, isLoading: isLoadingUser } = useCurrentUser()

  const count = recos?.length ?? 0
  const empresa = user?.empresa ?? ''
  const isLoading = isLoadingRecos || isLoadingUser

  return (
    <div>
      <h1 className="font-display text-text text-3xl font-extrabold tracking-tight">
        {t('title')}
      </h1>
      {isLoading ? (
        <div
          aria-hidden
          className="bg-surface-hover mt-2 h-4 w-72 animate-pulse rounded"
        />
      ) : (
        <p className="text-text-secondary mt-2 text-sm">
          {t('subtitleTemplate', {
            count,
            empresa,
            tiempo: t('lastUpdated'),
          })}
        </p>
      )}
    </div>
  )
}
