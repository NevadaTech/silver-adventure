'use client'

import { useTranslations } from 'next-intl'

import { useMiCluster } from '@/core/clusters/infrastructure/hooks/useMiCluster'
import { useUserConnections } from '@/core/connections/infrastructure/hooks/useUserConnections'
import { useRecomendaciones } from '@/core/recommendations/infrastructure/hooks/useRecomendaciones'
import { useCurrentUser } from '@/core/users/infrastructure/hooks/useCurrentUser'

import { InicioActivityTimelineLoader } from './inicio-activity-timeline-loader'
import { InicioConectorHero } from './inicio-conector-hero'
import { InicioGreeting } from './inicio-greeting'
import { InicioKpiGrid } from './inicio-kpi-grid'
import { InicioMiniCluster } from './inicio-mini-cluster'
import { InicioQuickActions } from './inicio-quick-actions'

export function InicioContent() {
  const t = useTranslations('App.Inicio')

  const { user } = useCurrentUser()
  const { data: recos = [] } = useRecomendaciones()
  const { data: connections = [], raw: rawConnections } = useUserConnections()
  const { cluster, isLoading: isClusterLoading } = useMiCluster()

  const dismissedRecIds = new Set(
    (rawConnections?.connections ?? [])
      .filter((c) => c.action === 'dismissed')
      .map((c) => c.recommendationId),
  )
  const newRecos = recos
    .filter((r) => !dismissedRecIds.has(r.id))
    .sort((a, b) => b.score - a.score)
  const heroReco = newRecos[0]

  const activeConnectionsCount = (rawConnections?.connections ?? []).filter(
    (c) => c.action === 'marked' || c.action === 'simulated_contact',
  ).length

  const stats = {
    newRecos: newRecos.length,
    activeConnections: activeConnectionsCount,
    clusterSize: cluster?.size ?? 0,
    centrality: cluster?.miembros.find((m) => m.flag === 'self')?.score ?? 0,
  }

  const oportunidadesHoy = newRecos.length

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
      <InicioGreeting
        nombre={user?.nombre ?? ''}
        oportunidades={oportunidadesHoy}
      />

      {heroReco ? (
        <InicioConectorHero reco={heroReco} />
      ) : (
        <InicioConectorHeroEmpty />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <InicioActivityTimelineLoader className="lg:col-span-2" />
        <div className="flex flex-col gap-6">
          <InicioKpiGrid stats={stats} />
          {cluster ? (
            <InicioMiniCluster cluster={cluster} />
          ) : (
            <InicioMiniClusterEmpty isLoading={isClusterLoading} />
          )}
        </div>
      </div>

      <InicioQuickActions
        recoCount={recos.length}
        conexionesCount={connections.length}
      />
    </div>
  )
}

function InicioConectorHeroEmpty() {
  const t = useTranslations('App.Inicio.heroEmpty')
  return (
    <section className="bg-primary text-primary-text rounded-3xl p-8 sm:p-10">
      <h2 className="font-display text-2xl leading-tight font-extrabold sm:text-3xl">
        {t('title')}
      </h2>
      <p className="text-primary-soft mt-3 text-sm leading-relaxed">
        {t('description')}
      </p>
    </section>
  )
}

function InicioMiniClusterEmpty({ isLoading }: { isLoading: boolean }) {
  const t = useTranslations('App.Inicio.miniCluster')
  if (isLoading) {
    return (
      <section
        aria-hidden
        className="bg-surface border-border-soft h-40 animate-pulse rounded-2xl border"
      />
    )
  }
  return (
    <section className="bg-surface border-border-soft flex flex-col gap-2 rounded-2xl border p-5">
      <p className="text-secondary text-xs font-bold tracking-wider uppercase">
        {t('title')}
      </p>
      <p className="text-text-secondary text-sm leading-relaxed">
        {t('emptyState')}
      </p>
    </section>
  )
}
