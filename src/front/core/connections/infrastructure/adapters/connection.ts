import type {
  BrainConnectionAction,
  BrainConnectionView,
} from '@/core/shared/infrastructure/brain/brainClient'
import type {
  Conexion,
  EstadoConexion,
  TipoRelacion,
} from '@/app/[locale]/app/_data/types'

export type ConnectionAction = BrainConnectionAction

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

const ACTION_TO_ESTADO: Record<BrainConnectionAction, EstadoConexion> = {
  marked: 'active',
  saved: 'pending',
  simulated_contact: 'active',
  dismissed: 'archived',
}

function relativeTime(isoDate: string): string {
  const created = new Date(isoDate).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - created)
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'hace instantes'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `hace ${diffHour} h`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `hace ${diffDay} d`
  const diffWeek = Math.floor(diffDay / 7)
  if (diffWeek < 4) return `hace ${diffWeek} sem`
  return new Date(isoDate).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  })
}

const RELATION_FALLBACK: TipoRelacion = 'aliado'

export function mapBrainConnectionToConexion(
  view: BrainConnectionView,
): Conexion | null {
  if (!view.targetCompany) return null
  const company = view.targetCompany
  return {
    id: view.id,
    actor: {
      id: company.id,
      iniciales: buildIniciales(company.razonSocial),
      nombre: company.razonSocial,
      sector: `CIIU ${company.ciiuSeccion}${company.ciiu}`,
      barrio: company.municipio,
      origen: 'formal',
      avatarColor: pickAvatarColor(company.id),
    },
    tipoRelacion: view.relationType ?? RELATION_FALLBACK,
    estado: ACTION_TO_ESTADO[view.action],
    ultimaInteraccion: relativeTime(view.createdAt),
    notas: view.note ?? undefined,
  }
}

export function mapBrainConnectionsToConexiones(
  views: BrainConnectionView[],
): Conexion[] {
  return views
    .map(mapBrainConnectionToConexion)
    .filter((c): c is Conexion => c !== null)
}
