'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import { useUserConnections } from '@/core/connections/infrastructure/hooks/useUserConnections'

import type {
  Ancla,
  Conexion,
  EstadoConexion,
  EstadoReco,
  Recomendacion,
} from '../_data/types'

import { ConexionesStats } from './conexiones-stats'
import { ConexionesRow } from './conexiones-row'
import { ConexionesTabs, type ConexionTabValue } from './conexiones-tabs'
import { RecoDetailDrawer } from './reco-detail-drawer'

const estadoToReco: Record<EstadoConexion, EstadoReco> = {
  active: 'guardada',
  pending: 'nueva',
  paused: 'descartada',
  archived: 'descartada',
}

function buildRecoFromConexion(
  conexion: Conexion,
  razon: string,
): Recomendacion {
  const anclas: Ancla[] = [
    {
      tipo: 'sector_compatible',
      valor: conexion.actor.sector,
    },
    {
      tipo: 'anios_operando',
      valor: conexion.actor.aniosOperando ?? 0,
    },
    {
      tipo: 'pares_conectados',
      valor: 1,
    },
  ]

  return {
    id: `conn-${conexion.id}`,
    target: conexion.actor,
    tipoRelacion: conexion.tipoRelacion,
    score: 100,
    razon,
    estado: estadoToReco[conexion.estado],
    anclas,
    siguienteAccion: 'aceptar_conexion',
  }
}

export function ConexionesList() {
  const t = useTranslations('App.Conexiones')

  const { data: live, isLoading, error } = useUserConnections()

  const [active, setActive] = useState<ConexionTabValue>('todas')
  const [overrides, setOverrides] = useState<Record<string, EstadoConexion>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const data = useMemo(() => {
    const source = live ?? []
    return source.map((c) =>
      overrides[c.id] ? { ...c, estado: overrides[c.id]! } : c,
    )
  }, [live, overrides])

  const counts = useMemo(() => {
    const base: Record<ConexionTabValue, number> = {
      todas: data.length,
      active: 0,
      pending: 0,
      paused: 0,
      archived: 0,
    }
    for (const c of data) {
      base[c.estado]++
    }
    return base
  }, [data])

  const filtered = useMemo(
    () => data.filter((c) => active === 'todas' || c.estado === active),
    [active, data],
  )

  const selected = selectedId
    ? (data.find((c) => c.id === selectedId) ?? null)
    : null

  const recoSeleccionada = useMemo(() => {
    if (!selected) return null
    return buildRecoFromConexion(
      selected,
      t('detailRazonTemplate', { nombre: selected.actor.nombre }),
    )
  }, [selected, t])

  function togglePause(conexion: Conexion) {
    const next: EstadoConexion =
      conexion.estado === 'paused' ? 'active' : 'paused'
    setOverrides((prev) => ({ ...prev, [conexion.id]: next }))
  }

  if (isLoading && data.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <ConexionesStats
          counts={{ active: 0, pending: 0, paused: 0, archived: 0 }}
        />
        <ul aria-hidden className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="bg-surface border-border-soft h-28 animate-pulse rounded-2xl border"
            />
          ))}
        </ul>
      </div>
    )
  }

  if (error) {
    return (
      <p
        role="alert"
        className="text-text-muted bg-surface border-border-soft rounded-2xl border p-10 text-center text-sm"
      >
        {t('errorState')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ConexionesStats
        counts={{
          active: counts.active,
          pending: counts.pending,
          paused: counts.paused,
          archived: counts.archived,
        }}
      />

      <ConexionesTabs active={active} counts={counts} onChange={setActive} />

      {filtered.length === 0 ? (
        <p className="text-text-muted bg-surface border-border-soft rounded-2xl border p-10 text-center text-sm">
          {t('emptyState')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((conexion, index) => (
            <li key={conexion.id}>
              <ConexionesRow
                conexion={conexion}
                index={index}
                onView={() => setSelectedId(conexion.id)}
                onTogglePause={() => togglePause(conexion)}
              />
            </li>
          ))}
        </ul>
      )}

      <RecoDetailDrawer
        reco={recoSeleccionada}
        onClose={() => setSelectedId(null)}
        onUpdateEstado={() => undefined}
      />
    </div>
  )
}
