import type {
  BrainClusterMembersResponse,
  BrainClusterMemberView,
  BrainValueChainEdge,
} from '@/core/shared/infrastructure/brain/brainClient'
import type {
  Actor,
  Cluster,
  ClusterMember,
  ClusterMemberFlag,
  ValueChainAdj,
  ValueChainTipo,
} from '@/app/[locale]/app/_data/types'

const AVATAR_PALETTE: readonly string[] = [
  'bg-primary-soft text-primary',
  'bg-secondary-soft text-secondary-hover',
  'bg-accent-soft text-accent',
  'bg-info-soft text-info',
  'bg-success-soft text-success',
  'bg-warning-soft text-warning',
]

function pickAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function buildIniciales(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-záéíóúñ]/i.test(w[0]))
  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

function memberToActor(m: BrainClusterMemberView): Actor {
  return {
    id: m.id,
    iniciales: buildIniciales(m.razonSocial),
    nombre: m.razonSocial,
    sector: `CIIU ${m.ciiuSeccion}${m.ciiu}`,
    barrio: m.municipio,
    origen: 'formal',
    avatarColor: m.isSelf
      ? 'bg-primary text-primary-text'
      : pickAvatarColor(m.id),
  }
}

const VALUE_CHAIN_LABELS: Record<ValueChainTipo, string> = {
  proveedor: 'Proveedores potenciales',
  cliente: 'Clientes potenciales',
  aliado: 'Aliados estratégicos',
}

function buildLabel(edge: BrainValueChainEdge): string {
  const fallback =
    VALUE_CHAIN_LABELS[edge.relationType as ValueChainTipo] ?? 'Conexiones'
  if (edge.topTargets.length === 0) return fallback
  const names = edge.topTargets
    .slice(0, 2)
    .map((t) => t.razonSocial.split(/\s+/)[0])
  return `${fallback} · ${names.join(', ')}${edge.count > 2 ? '…' : ''}`
}

function isValueChainTipo(value: string): value is ValueChainTipo {
  return value === 'proveedor' || value === 'cliente' || value === 'aliado'
}

const ETAPA_HUMAN: Record<string, string> = {
  nacimiento: 'Nacimiento',
  crecimiento: 'Crecimiento',
  consolidacion: 'Consolidación',
  madurez: 'Madurez',
}

function buildEtapaLabel(
  cluster: BrainClusterMembersResponse['cluster'],
): string {
  if (cluster.etapa && ETAPA_HUMAN[cluster.etapa]) {
    return ETAPA_HUMAN[cluster.etapa]
  }
  switch (cluster.tipo) {
    case 'predefined':
      return 'Cluster estratégico'
    case 'heuristic-grupo':
      return 'Cluster por grupo CIIU'
    case 'heuristic-division':
      return 'Cluster por división CIIU'
    case 'heuristic-municipio':
      return 'Cluster geográfico'
    case 'heuristic-etapa':
      return 'Cluster por etapa'
    case 'heuristic-hibrido':
      return 'Cluster híbrido'
    default:
      return 'Activo'
  }
}

function buildCentroide(
  cluster: BrainClusterMembersResponse['cluster'],
  memberCount: number,
): string[] {
  const traits: string[] = []
  traits.push(cluster.titulo)
  if (cluster.ciiuDivision) {
    traits.push(`División CIIU ${cluster.ciiuDivision}`)
  }
  if (cluster.ciiuGrupo) {
    traits.push(`Grupo CIIU ${cluster.ciiuGrupo}`)
  }
  if (cluster.municipio) {
    traits.push(cluster.municipio)
  }
  if (cluster.etapa && ETAPA_HUMAN[cluster.etapa]) {
    traits.push(`Etapa: ${ETAPA_HUMAN[cluster.etapa]}`)
  }
  if (cluster.tipo === 'predefined') {
    traits.push('Cluster estratégico de la Cámara')
  }
  traits.push(`${memberCount} empresas en el cluster`)
  return traits
}

export function mapBrainClusterToCluster(
  payload: BrainClusterMembersResponse,
  selfCompanyId: string | null,
): Cluster {
  const totalMembers = payload.cluster.memberCount
  const sortedMembers: ClusterMember[] = payload.members.map((m, index) => {
    const isSelf = m.id === selfCompanyId
    const flag: ClusterMemberFlag = isSelf ? 'self' : 'not_connected'
    return {
      actor: memberToActor(m),
      flag,
      score: isSelf ? 95 : Math.max(35, 90 - index * 3),
    }
  })

  const cadenas: ValueChainAdj[] = payload.valueChains
    .filter((edge) => isValueChainTipo(edge.relationType))
    .map((edge) => ({
      tipo: edge.relationType as ValueChainTipo,
      etiqueta: buildLabel(edge),
      count: edge.count,
      topIniciales: edge.topTargets.map((t) => buildIniciales(t.razonSocial)),
    }))

  return {
    id: payload.cluster.id,
    etiqueta: payload.cluster.titulo,
    etapa: buildEtapaLabel(payload.cluster),
    size: totalMembers,
    conexionesActivas: cadenas.reduce((acc, c) => acc + c.count, 0),
    centroide: buildCentroide(payload.cluster, totalMembers),
    miembros: sortedMembers,
    cadenasDeValor: cadenas,
  }
}
