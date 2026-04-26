import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import type { Cluster } from '../_data/types'

type Props = {
  cluster: Cluster
}

export function InicioMiniCluster({ cluster }: Props) {
  const t = useTranslations('App.Inicio.miniCluster')

  const connected = cluster.miembros.filter((m) => m.flag === 'connected')
  const visibles = connected.slice(0, 4)
  const restantes = Math.max(connected.length - visibles.length, 0)

  return (
    <section className="bg-surface border-border-soft flex flex-col gap-4 rounded-2xl border p-5">
      <header>
        <p className="text-secondary text-xs font-bold tracking-wider uppercase">
          {t('title')}
        </p>
        <p className="font-display text-text mt-1 text-base leading-tight font-bold">
          {cluster.etiqueta}
        </p>
        <p className="text-text-muted mt-0.5 text-xs">{cluster.etapa}</p>
      </header>

      <div className="flex items-center -space-x-2">
        {visibles.map((member) => (
          <span
            key={member.actor.id}
            title={member.actor.nombre}
            className={`border-surface grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-bold ${member.actor.avatarColor}`}
          >
            {member.actor.iniciales}
          </span>
        ))}
        {restantes > 0 ? (
          <span className="border-surface bg-bg-tertiary text-text-secondary grid h-9 w-9 place-items-center rounded-full border-2 text-[10px] font-bold">
            {t('plusNTemplate', { count: restantes })}
          </span>
        ) : null}
      </div>

      <Link
        href="/app/mi-cluster"
        className="text-secondary hover:text-secondary-hover inline-flex items-center gap-1 text-xs font-semibold transition-colors"
      >
        {t('viewAll')}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  )
}
