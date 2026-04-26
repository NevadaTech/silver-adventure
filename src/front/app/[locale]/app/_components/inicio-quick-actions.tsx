import { ArrowRight, Compass, Network, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

type Props = {
  recoCount: number
  conexionesCount: number
}

export function InicioQuickActions({ recoCount, conexionesCount }: Props) {
  const t = useTranslations('App.Inicio.actions')

  const items = [
    {
      href: '/app/recomendaciones',
      icon: Compass,
      iconClass: 'bg-secondary-soft text-secondary-hover',
      title: t('recomendaciones'),
      hint: t('recomendacionesCount', { count: recoCount }),
    },
    {
      href: '/app/conexiones',
      icon: Network,
      iconClass: 'bg-success/15 text-success',
      title: t('conexiones'),
      hint: t('conexionesCount', { count: conexionesCount }),
    },
    {
      href: '/app/mi-cluster',
      icon: Users,
      iconClass: 'bg-primary-soft text-primary',
      title: t('miCluster'),
      hint: t('miClusterHint'),
    },
  ] as const

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="bg-surface border-border-soft hover:border-secondary/40 group flex items-center gap-4 rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span
              className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl ${item.iconClass}`}
            >
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-text text-sm leading-tight font-bold">
                {item.title}
              </p>
              <p className="text-text-muted mt-0.5 text-xs">{item.hint}</p>
            </div>
            <ArrowRight className="text-text-muted group-hover:text-secondary h-4 w-4 transition-colors" />
          </Link>
        )
      })}
    </section>
  )
}
