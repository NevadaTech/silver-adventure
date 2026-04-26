'use client'

import { ArrowRight, MessageCircle, Pause, Play, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { Conexion } from '../_data/types'

import { ConexionesStatusPill } from './conexiones-status-pill'
import { RecoTipoPill } from './reco-tipo-pill'

const FALLBACK_WHATSAPP = '573000000000'

type Props = {
  conexion: Conexion
  index: number
  onView: () => void
  onTogglePause: () => void
}

export function ConexionesRow({
  conexion,
  index,
  onView,
  onTogglePause,
}: Props) {
  const t = useTranslations('App.Conexiones')
  const tActions = useTranslations('App.Conexiones.actions')

  const target = conexion.actor
  const isPaused = conexion.estado === 'paused'
  const isArchived = conexion.estado === 'archived'

  const whatsappNumber = target.whatsapp
    ? `57${target.whatsapp.replace(/\D/g, '')}`
    : FALLBACK_WHATSAPP
  const prefilled = encodeURIComponent(
    t('whatsappPrefilledTemplate', { nombre: target.nombre }),
  )
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${prefilled}`

  return (
    <article
      className="bg-surface border-border-soft animate-fade-up flex flex-col gap-4 rounded-2xl border p-5"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <header className="flex items-start gap-4">
        <span
          className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl text-base font-bold ${target.avatarColor}`}
          aria-hidden
        >
          {target.iniciales}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-text text-base leading-tight font-bold">
              {target.nombre}
            </h3>
            <span className="text-text-muted text-xs font-semibold">
              {t('lastInteractionLabel')}: {conexion.ultimaInteraccion}
            </span>
          </div>
          <p className="text-text-muted mt-1 text-xs">
            {target.sector} · {target.barrio}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RecoTipoPill tipo={conexion.tipoRelacion} />
            <ConexionesStatusPill estado={conexion.estado} />
          </div>
        </div>
      </header>

      {conexion.proximaAccion ? (
        <div className="bg-secondary-soft/30 border-secondary/20 rounded-xl border p-3">
          <p className="text-secondary-hover flex items-start gap-2 text-xs">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span className="leading-relaxed">
              <strong className="font-bold">{t('conectorSuggests')}: </strong>
              <span className="font-medium">{conexion.proximaAccion}</span>
            </span>
          </p>
        </div>
      ) : null}

      {conexion.notas ? (
        <p className="text-text-muted text-xs">{conexion.notas}</p>
      ) : null}

      <footer className="border-border-soft flex flex-wrap items-center gap-2 border-t pt-4">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`bg-success/10 text-success hover:bg-success/15 inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
            isArchived ? 'pointer-events-none opacity-50' : ''
          }`}
          aria-disabled={isArchived}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {tActions('whatsapp')}
        </a>
        {!isArchived ? (
          <button
            type="button"
            onClick={onTogglePause}
            className="border-border-soft text-text-secondary hover:bg-surface-hover hover:text-text inline-flex min-h-[40px] items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors"
          >
            {isPaused ? (
              <>
                <Play className="h-3.5 w-3.5" />
                {tActions('activate')}
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                {tActions('pause')}
              </>
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onView}
          className="text-text-secondary hover:text-text ml-auto inline-flex min-h-[40px] items-center gap-1 text-xs font-semibold transition-colors"
        >
          {tActions('view')}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </footer>
    </article>
  )
}
