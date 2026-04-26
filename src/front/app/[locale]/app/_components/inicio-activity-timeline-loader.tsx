'use client'

import { useTranslations } from 'next-intl'

import { useAgentEvents } from '@/core/agent/infrastructure/hooks/useAgentEvents'

import { InicioActivityTimeline } from './inicio-activity-timeline'

type Props = {
  className?: string
}

export function InicioActivityTimelineLoader({ className }: Props) {
  const t = useTranslations('App.Inicio.activity')
  const { events, isLoading, error, reason } = useAgentEvents()

  if (isLoading && !events) {
    return (
      <section
        aria-hidden
        className={`bg-surface border-border-soft rounded-3xl border p-6 sm:p-8 ${className ?? ''}`}
      >
        <header className="mb-6">
          <h2 className="font-display text-text text-lg font-bold">
            {t('title')}
          </h2>
          <p className="text-text-muted mt-1 text-sm">{t('subtitle')}</p>
        </header>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface-hover h-12 animate-pulse rounded-xl"
            />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className={`bg-surface border-border-soft rounded-3xl border p-6 sm:p-8 ${className ?? ''}`}
      >
        <h2 className="font-display text-text text-lg font-bold">
          {t('title')}
        </h2>
        <p
          role="alert"
          className="text-text-secondary mt-2 text-sm leading-relaxed"
        >
          {t('errorState')}
        </p>
      </section>
    )
  }

  if (!events || events.length === 0) {
    return (
      <section
        className={`bg-surface border-border-soft rounded-3xl border p-6 sm:p-8 ${className ?? ''}`}
      >
        <h2 className="font-display text-text text-lg font-bold">
          {t('title')}
        </h2>
        <p className="text-text-secondary mt-2 text-sm leading-relaxed">
          {reason === 'no_company' ? t('noCompany') : t('emptyState')}
        </p>
      </section>
    )
  }

  return <InicioActivityTimeline events={events} className={className} />
}
