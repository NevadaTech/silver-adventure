import { Network, Users, Target } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { Cluster } from '../_data/types'

type Props = {
  cluster: Cluster
}

export function ClusterSummary({ cluster }: Props) {
  const t = useTranslations('App.MiCluster')

  const selfMember = cluster.miembros.find((m) => m.flag === 'self')
  const centrality = selfMember?.score ?? 0

  return (
    <header className="bg-surface border-border-soft rounded-3xl border p-6 shadow-sm sm:p-8">
      <span className="text-secondary text-xs font-bold tracking-wider uppercase">
        {t('eyebrow')}
      </span>
      <h1 className="font-display text-text mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
        {cluster.etiqueta}
      </h1>
      <p className="text-text-secondary mt-2 text-sm font-medium">
        {t('etapaLabel')}: {cluster.etapa}
      </p>

      <dl className="border-border-soft mt-6 grid grid-cols-1 gap-5 border-t pt-6 sm:grid-cols-3">
        <Stat
          icon={<Users className="h-4 w-4" />}
          label={t('stats.members')}
          value={String(cluster.size)}
        />
        <Stat
          icon={<Network className="h-4 w-4" />}
          label={t('stats.activeConnections')}
          value={t('stats.activeConnectionsValue', {
            count: cluster.conexionesActivas,
          })}
        />
        <Stat
          icon={<Target className="h-4 w-4" />}
          label={t('stats.centrality')}
          value={`${centrality}%`}
        />
      </dl>
    </header>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-secondary-soft text-secondary-hover grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl">
        {icon}
      </span>
      <div>
        <dt className="text-text-muted text-xs font-semibold tracking-wider uppercase">
          {label}
        </dt>
        <dd className="text-text mt-0.5 text-base font-bold">{value}</dd>
      </div>
    </div>
  )
}
