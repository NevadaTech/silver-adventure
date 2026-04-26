import { Compass, Network, Target, Users, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Stat = {
  key: 'newRecos' | 'activeConnections' | 'clusterSize' | 'centrality'
  value: string
  delta?: number
  icon: LucideIcon
  iconClass: string
}

type Props = {
  stats: {
    newRecos: number
    activeConnections: number
    clusterSize: number
    centrality: number
  }
}

export function InicioKpiGrid({ stats }: Props) {
  const t = useTranslations('App.Inicio.kpi')

  const items: Stat[] = [
    {
      key: 'newRecos',
      value: String(stats.newRecos),
      delta: 2,
      icon: Compass,
      iconClass: 'bg-secondary-soft text-secondary-hover',
    },
    {
      key: 'activeConnections',
      value: String(stats.activeConnections),
      delta: 1,
      icon: Network,
      iconClass: 'bg-success/15 text-success',
    },
    {
      key: 'clusterSize',
      value: String(stats.clusterSize),
      icon: Users,
      iconClass: 'bg-primary-soft text-primary',
    },
    {
      key: 'centrality',
      value: `${stats.centrality}%`,
      delta: 4,
      icon: Target,
      iconClass: 'bg-accent/30 text-accent-text',
    },
  ]

  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((stat) => {
        const Icon = stat.icon
        return (
          <li
            key={stat.key}
            className="bg-surface border-border-soft flex flex-col gap-3 rounded-2xl border p-4"
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-xl ${stat.iconClass}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-text font-display text-2xl leading-none font-extrabold">
                {stat.value}
              </p>
              <p className="text-text-muted mt-1 text-xs leading-tight">
                {t(stat.key)}
              </p>
              {stat.delta ? (
                <p className="text-success mt-1 text-[10px] font-semibold">
                  {t('deltaTemplate', { count: stat.delta })}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
