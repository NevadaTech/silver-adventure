'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import type {
  Ancla,
  ClusterMember,
  EstadoReco,
  Recomendacion,
} from '../_data/types'

import { ClusterMemberCard } from './cluster-member-card'
import { RecoDetailDrawer } from './reco-detail-drawer'

type Props = {
  miembros: ClusterMember[]
  centroide: string[]
}

/**
 * Adapter: synthesize a Recomendacion from a cluster member so we can
 * reuse the existing detail drawer. Once we have a real cluster-detail
 * UX we can split it.
 */
function buildRecoFromMember(
  member: ClusterMember,
  centroide: string[],
  razon: string,
): Recomendacion {
  const estado: EstadoReco = member.flag === 'connected' ? 'guardada' : 'nueva'

  const anclas: Ancla[] = [
    { tipo: 'sector_compatible', valor: centroide[0] ?? 'Sector compatible' },
    {
      tipo: 'programa_compartido',
      valor:
        member.actor.programas?.[0] ?? centroide[centroide.length - 1] ?? '—',
    },
    { tipo: 'anios_operando', valor: member.actor.aniosOperando ?? 0 },
  ]

  return {
    id: `cluster-${member.actor.id}`,
    target: member.actor,
    tipoRelacion: 'aliado',
    score: member.score,
    razon,
    estado,
    anclas,
    siguienteAccion: 'aceptar_conexion',
  }
}

export function ClusterMembers({ miembros, centroide }: Props) {
  const t = useTranslations('App.MiCluster.members')
  const tAdapter = useTranslations('App.MiCluster')

  const [selected, setSelected] = useState<Recomendacion | null>(null)

  function handleSelect(member: ClusterMember) {
    if (member.flag === 'self') return
    const traits = centroide.join(' · ')
    const razon = tAdapter('adapterRazonTemplate', { traits })
    const reco = buildRecoFromMember(member, centroide, razon)
    setSelected(reco)
  }

  function handleUpdateEstado(id: string, estado: EstadoReco) {
    setSelected((prev) => (prev && prev.id === id ? { ...prev, estado } : prev))
  }

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h2 className="font-display text-text text-xl font-bold">
          {t('title')}
        </h2>
        <p className="text-text-muted mt-1 text-sm">{t('subtitle')}</p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {miembros.map((member, index) => (
          <li key={member.actor.id} className="contents">
            <ClusterMemberCard
              member={member}
              index={index}
              isClickable={member.flag !== 'self'}
              onSelect={() => handleSelect(member)}
            />
          </li>
        ))}
      </ul>

      <RecoDetailDrawer
        reco={selected}
        onClose={() => setSelected(null)}
        onUpdateEstado={handleUpdateEstado}
      />
    </section>
  )
}
