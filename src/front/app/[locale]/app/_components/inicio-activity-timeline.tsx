import {
  AlertCircle,
  RefreshCcw,
  Send,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { ConectorEvent, ConectorEventTipo } from '../_data/types'

const tipoIcon: Record<ConectorEventTipo, LucideIcon> = {
  recalculo_nocturno: RefreshCcw,
  recomendacion_nueva: Sparkles,
  miembro_cluster_nuevo: UserPlus,
  recomendacion_a_otros: Send,
  priorizacion_humana: AlertCircle,
}

const tipoStyle: Record<ConectorEventTipo, string> = {
  recalculo_nocturno: 'bg-secondary-soft text-secondary-hover',
  recomendacion_nueva: 'bg-success/15 text-success',
  miembro_cluster_nuevo: 'bg-primary-soft text-primary',
  recomendacion_a_otros: 'bg-accent/30 text-accent-text',
  priorizacion_humana: 'bg-error/15 text-error',
}

type Props = {
  events: ConectorEvent[]
  className?: string
}

export function InicioActivityTimeline({ events, className }: Props) {
  const t = useTranslations('App.Inicio.activity')

  return (
    <section
      className={`bg-surface border-border-soft rounded-3xl border p-6 sm:p-8 ${className ?? ''}`}
    >
      <header className="mb-6">
        <h2 className="font-display text-text text-lg font-bold">
          {t('title')}
        </h2>
        <p className="text-text-muted mt-1 text-sm">{t('subtitle')}</p>
      </header>

      <ol className="relative flex flex-col gap-5 pl-2">
        <span
          aria-hidden
          className="bg-border-soft absolute top-2 bottom-2 left-[15px] w-px"
        />
        {events.map((evt, index) => {
          const Icon = tipoIcon[evt.tipo]
          return (
            <li
              key={evt.id}
              className="animate-fade-up relative flex items-start gap-4"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span
                className={`bg-surface ring-border-soft relative z-10 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full ring-2 ${tipoStyle[evt.tipo]}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-text font-display text-sm font-bold">
                    {evt.titulo}
                  </p>
                  <time className="text-text-muted text-xs font-semibold tracking-wider uppercase">
                    {evt.timestamp}
                  </time>
                </div>
                <p className="text-text-secondary mt-1 text-sm leading-relaxed">
                  {evt.detalle}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="border-border-soft text-text-muted mt-6 border-t pt-4 text-center text-xs">
        {t('viewAll')}
      </p>
    </section>
  )
}
