'use client'

import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { mockRecomendaciones } from '../_data/mock-recomendaciones'
import type { EstadoReco, Recomendacion, TipoRelacion } from '../_data/types'

import { RecoActor } from './reco-actor'
import { RecoDetailDrawer } from './reco-detail-drawer'
import { RecoStatusPill } from './reco-status-pill'
import { RecoTipoPill } from './reco-tipo-pill'
import { RecoTabs, type TabValue } from './reco-tabs'

const PAGE_SIZE = 8

export function RecoTable() {
  const t = useTranslations('App.Recomendaciones')

  const [active, setActive] = useState<TabValue>('todas')
  const [showAll, setShowAll] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, EstadoReco>>({})

  const data = useMemo(
    () =>
      mockRecomendaciones.map((reco) =>
        overrides[reco.id] ? { ...reco, estado: overrides[reco.id]! } : reco,
      ),
    [overrides],
  )

  const counts = useMemo(() => {
    const base: Record<TabValue, number> = {
      todas: data.length,
      proveedor: 0,
      aliado: 0,
      cliente: 0,
      referente: 0,
    }
    for (const reco of data) {
      base[reco.tipoRelacion as TipoRelacion]++
    }
    return base
  }, [data])

  const sorted = useMemo(
    () =>
      [...data]
        .filter((r) => active === 'todas' || r.tipoRelacion === active)
        .sort((a, b) => b.score - a.score),
    [active, data],
  )

  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE)
  const total = sorted.length
  const visibleCount = visible.length

  const selected = selectedId
    ? (data.find((r) => r.id === selectedId) ?? null)
    : null

  function openDetail(reco: Recomendacion) {
    setSelectedId(reco.id)
    if (reco.estado === 'nueva') {
      setOverrides((prev) => ({ ...prev, [reco.id]: 'vista' }))
    }
  }

  function updateEstado(id: string, estado: EstadoReco) {
    setOverrides((prev) => ({ ...prev, [id]: estado }))
  }

  return (
    <div className="flex flex-col gap-6">
      <RecoTabs
        active={active}
        counts={counts}
        onChange={(v) => {
          setActive(v)
          setShowAll(false)
        }}
      />

      <div className="bg-surface border-border-soft overflow-hidden rounded-2xl border">
        <DesktopTable rows={visible} onSelect={openDetail} />
        <MobileList rows={visible} onSelect={openDetail} />
      </div>

      <p className="text-text-muted text-center text-xs">
        {t('footerTemplate', { visible: visibleCount, total })}
        {visibleCount < total ? (
          <>
            {' · '}
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-secondary hover:text-secondary-hover font-semibold transition-colors"
            >
              {t('cargarMas')}
            </button>
          </>
        ) : null}
      </p>

      <RecoDetailDrawer
        reco={selected}
        onClose={() => setSelectedId(null)}
        onUpdateEstado={updateEstado}
      />
    </div>
  )
}

type RowProps = {
  rows: Recomendacion[]
  onSelect: (reco: Recomendacion) => void
}

function DesktopTable({ rows, onSelect }: RowProps) {
  const t = useTranslations('App.Recomendaciones')

  return (
    <table className="hidden w-full text-left md:table">
      <thead>
        <tr className="border-border-soft bg-bg-secondary text-text-muted border-b text-xs font-semibold tracking-wider uppercase">
          <th className="px-5 py-3 font-semibold">{t('columns.actor')}</th>
          <th className="px-5 py-3 font-semibold">{t('columns.tipo')}</th>
          <th className="px-5 py-3 font-semibold">{t('columns.match')}</th>
          <th className="px-5 py-3 font-semibold">{t('columns.porQue')}</th>
          <th className="px-5 py-3 font-semibold">{t('columns.estado')}</th>
          <th className="px-5 py-3" aria-label={t('columns.acciones')} />
        </tr>
      </thead>
      <tbody className="divide-border-soft divide-y">
        {rows.map((reco, index) => (
          <tr
            key={reco.id}
            className="hover:bg-bg-secondary/40 animate-fade-up cursor-pointer transition-colors"
            style={{ animationDelay: `${index * 30}ms` }}
            onClick={() => onSelect(reco)}
          >
            <td className="px-5 py-4">
              <RecoActor actor={reco.target} />
            </td>
            <td className="px-5 py-4">
              <RecoTipoPill tipo={reco.tipoRelacion} />
            </td>
            <td className="px-5 py-4">
              <span className="text-text text-base font-bold">
                {reco.score}
              </span>
              <span className="text-text-muted ml-0.5 text-xs">%</span>
            </td>
            <td className="text-text-secondary max-w-md px-5 py-4 text-sm leading-relaxed">
              <span className="line-clamp-2">{reco.razon}</span>
            </td>
            <td className="px-5 py-4">
              <RecoStatusPill estado={reco.estado} />
            </td>
            <td className="px-5 py-4 text-right">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(reco)
                }}
                className="border-border-soft text-text-secondary hover:bg-surface-hover hover:text-text inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                {t('ver')}
                <ArrowRight className="h-3 w-3" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MobileList({ rows, onSelect }: RowProps) {
  const t = useTranslations('App.Recomendaciones')

  return (
    <ul className="divide-border-soft divide-y md:hidden">
      {rows.map((reco, index) => (
        <li
          key={reco.id}
          className="animate-fade-up flex flex-col gap-3 p-4"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <RecoActor actor={reco.target} />
            <span className="text-text text-base font-bold">
              {reco.score}
              <span className="text-text-muted text-xs">%</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RecoTipoPill tipo={reco.tipoRelacion} />
            <RecoStatusPill estado={reco.estado} />
          </div>
          <p className="text-text-secondary text-sm leading-relaxed">
            {reco.razon}
          </p>
          <button
            type="button"
            onClick={() => onSelect(reco)}
            className="border-border-soft text-text-secondary hover:bg-surface-hover hover:text-text inline-flex w-fit items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            {t('ver')}
            <ArrowRight className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  )
}
