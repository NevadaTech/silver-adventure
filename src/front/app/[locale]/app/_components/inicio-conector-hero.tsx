'use client'

import { useState } from 'react'
import { ArrowRight, Bot, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { EstadoReco, Recomendacion } from '../_data/types'

import { RecoDetailDrawer } from './reco-detail-drawer'
import { RecoTipoPill } from './reco-tipo-pill'

type Props = {
  reco: Recomendacion
}

export function InicioConectorHero({ reco }: Props) {
  const t = useTranslations('App.Inicio.hero')

  const [open, setOpen] = useState(false)
  const [estado, setEstado] = useState<EstadoReco>(reco.estado)

  const recoForDrawer = open ? { ...reco, estado } : null

  return (
    <section className="bg-primary text-primary-text relative overflow-hidden rounded-3xl p-8 shadow-lg shadow-black/10 sm:p-10">
      <div
        aria-hidden
        className="bg-secondary/30 absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-accent/20 absolute -bottom-20 -left-20 h-64 w-64 rounded-full blur-3xl"
      />

      <div className="relative">
        <div className="bg-secondary text-secondary-text mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase">
          <Bot className="h-3.5 w-3.5" />
          {t('eyebrow')}
        </div>
        <h2 className="font-display mb-6 text-2xl leading-tight font-extrabold sm:text-3xl">
          {t('title')}
        </h2>

        <div className="ring-secondary/20 rounded-2xl bg-white/5 p-5 ring-1 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <span
              className={`grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl text-base font-bold ${reco.target.avatarColor}`}
              aria-hidden
            >
              {reco.target.iniciales}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-primary-text text-lg leading-tight font-bold">
                {reco.target.nombre}
              </p>
              <p className="text-primary-soft mt-1 text-xs">
                {reco.target.sector} · {reco.target.barrio}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="bg-secondary/15 text-secondary inline-flex items-baseline gap-1 rounded-md px-2.5 py-1">
                  <span className="text-base font-bold">{reco.score}</span>
                  <span className="text-[10px] font-semibold">%</span>
                </div>
                <RecoTipoPill tipo={reco.tipoRelacion} />
              </div>
            </div>
          </div>
          <p className="text-primary-soft mt-4 text-sm leading-relaxed">
            {reco.razon}
          </p>
        </div>

        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-secondary-soft text-secondary-hover hover:bg-secondary-soft/80 inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl px-6 font-semibold transition-colors active:scale-95"
          >
            {t('ctaPrimary')}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="text-primary-soft inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/15 px-6 text-sm font-semibold transition-colors hover:bg-white/5"
          >
            <Clock className="h-4 w-4" />
            {t('ctaSecondary')}
          </button>
        </div>
      </div>

      <RecoDetailDrawer
        reco={recoForDrawer}
        onClose={() => setOpen(false)}
        onUpdateEstado={(_id, next) => setEstado(next)}
      />
    </section>
  )
}
