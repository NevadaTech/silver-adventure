'use client'

import { useTranslations } from 'next-intl'

import { useMiCluster } from '@/core/clusters/infrastructure/hooks/useMiCluster'

import { ClusterMembers } from './cluster-members'
import { ClusterSummary } from './cluster-summary'
import { ClusterTraits } from './cluster-traits'
import { ClusterValueChains } from './cluster-value-chains'

export function MiClusterContent() {
  const t = useTranslations('App.MiCluster')
  const { cluster, isLoading, error, reason } = useMiCluster()

  if (isLoading && !cluster) {
    return <MiClusterSkeleton />
  }

  if (error) {
    return (
      <div className="bg-surface border-border-soft rounded-3xl border p-10 text-center">
        <h2 className="font-display text-text text-lg font-bold">
          {t('errorState.title')}
        </h2>
        <p className="text-text-secondary mt-2 text-sm">
          {t('errorState.description')}
        </p>
      </div>
    )
  }

  if (!cluster) {
    return (
      <div className="bg-surface border-border-soft rounded-3xl border p-10 text-center">
        <h2 className="font-display text-text text-lg font-bold">
          {t('empty.title')}
        </h2>
        <p className="text-text-secondary mt-2 text-sm">
          {reason === 'no_company'
            ? t('empty.noCompanyDescription')
            : t('empty.description')}
        </p>
      </div>
    )
  }

  return (
    <>
      <ClusterSummary cluster={cluster} />
      <ClusterTraits centroide={cluster.centroide} />
      <ClusterMembers
        miembros={cluster.miembros}
        centroide={cluster.centroide}
      />
      <ClusterValueChains cadenas={cluster.cadenasDeValor} />
    </>
  )
}

function MiClusterSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="bg-surface border-border-soft h-40 animate-pulse rounded-3xl border" />
      <div className="bg-surface border-border-soft h-32 animate-pulse rounded-3xl border" />
      <div className="bg-surface border-border-soft h-64 animate-pulse rounded-3xl border" />
      <div className="bg-surface border-border-soft h-48 animate-pulse rounded-3xl border" />
    </div>
  )
}
