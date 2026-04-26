import { describe, expect, it } from 'vitest'

import { mapBrainClusterToCluster } from '@/core/clusters/infrastructure/adapters/cluster'
import type { BrainClusterMembersResponse } from '@/core/shared/infrastructure/brain/brainClient'

const baseCluster: BrainClusterMembersResponse['cluster'] = {
  id: 'pred-8',
  codigo: 'TURISMO',
  titulo: 'Turismo',
  descripcion: null,
  tipo: 'predefined',
  ciiuDivision: null,
  ciiuGrupo: null,
  municipio: null,
  etapa: null,
  memberCount: 155,
}

const member = (
  id: string,
  overrides: Partial<BrainClusterMembersResponse['members'][number]> = {},
): BrainClusterMembersResponse['members'][number] => ({
  id,
  razonSocial: `Empresa ${id}`,
  ciiu: '5611',
  ciiuSeccion: 'I',
  ciiuDivision: '56',
  municipio: 'SANTA MARTA',
  etapa: 'crecimiento',
  isSelf: false,
  ...overrides,
})

describe('mapBrainClusterToCluster', () => {
  it('produces a friendly etapa label for predefined clusters', () => {
    const result = mapBrainClusterToCluster(
      {
        cluster: baseCluster,
        members: [],
        valueChains: [],
        partial: false,
      },
      null,
    )
    expect(result.etapa).toBe('Cluster estratégico')
  })

  it('uses the human etapa label when the cluster carries one', () => {
    const result = mapBrainClusterToCluster(
      {
        cluster: {
          ...baseCluster,
          tipo: 'heuristic-etapa',
          etapa: 'consolidacion',
          municipio: 'SANTA MARTA',
        },
        members: [],
        valueChains: [],
        partial: false,
      },
      null,
    )
    expect(result.etapa).toBe('Consolidación')
  })

  it('flags the user as self and everyone else as not_connected', () => {
    const result = mapBrainClusterToCluster(
      {
        cluster: baseCluster,
        members: [
          member('comp-self', { isSelf: true }),
          member('comp-a'),
          member('comp-b'),
        ],
        valueChains: [],
        partial: false,
      },
      'comp-self',
    )

    const flags = result.miembros.map((m) => ({ id: m.actor.id, flag: m.flag }))
    expect(flags).toEqual([
      { id: 'comp-self', flag: 'self' },
      { id: 'comp-a', flag: 'not_connected' },
      { id: 'comp-b', flag: 'not_connected' },
    ])
  })

  it('builds a non-empty centroide for a predefined cluster without CIIU/municipio', () => {
    const result = mapBrainClusterToCluster(
      {
        cluster: baseCluster,
        members: [],
        valueChains: [],
        partial: false,
      },
      null,
    )

    expect(result.centroide).toContain('Turismo')
    expect(result.centroide).toContain('Cluster estratégico de la Cámara')
    expect(
      result.centroide.some((trait) => trait.includes('155 empresas')),
    ).toBe(true)
  })

  it('maps value chains to friendly labels with top initials', () => {
    const result = mapBrainClusterToCluster(
      {
        cluster: baseCluster,
        members: [],
        valueChains: [
          {
            relationType: 'proveedor',
            count: 3,
            topTargets: [
              { id: 'a', razonSocial: 'Pescadería La Bahía' },
              { id: 'b', razonSocial: 'Frutas del Caribe' },
            ],
          },
        ],
        partial: false,
      },
      null,
    )

    expect(result.cadenasDeValor).toHaveLength(1)
    expect(result.cadenasDeValor[0].tipo).toBe('proveedor')
    expect(result.cadenasDeValor[0].count).toBe(3)
    expect(result.cadenasDeValor[0].topIniciales).toEqual(['PL', 'FD'])
  })
})
