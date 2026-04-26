import type { BrainAgentEvent } from '@/core/shared/infrastructure/brain/brainClient'
import type {
  ConectorEvent,
  ConectorEventTipo,
} from '@/app/[locale]/app/_data/types'

interface EventCopy {
  tipo: ConectorEventTipo
  titulo: string
  detalle: (event: BrainAgentEvent) => string
}

const FALLBACK: EventCopy = {
  tipo: 'recalculo_nocturno',
  titulo: 'El conector trabajó en tu red',
  detalle: () => 'Detectó cambios en tu cluster y los aplicó.',
}

const COPY_BY_TYPE: Record<string, EventCopy> = {
  new_high_score_match: {
    tipo: 'recomendacion_nueva',
    titulo: 'Match de alto score',
    detalle: (e) => {
      const score = pickNumber(e.payload.score)
      const tipo = pickString(e.payload.type)
      const target = pickString(e.payload.targetId)
      const parts: string[] = []
      if (score !== null) parts.push(`Score ${(score * 100).toFixed(0)}%`)
      if (tipo) parts.push(`Tipo: ${tipo}`)
      if (target) parts.push(`Empresa ${target}`)
      return parts.length > 0
        ? parts.join(' · ')
        : 'Encontramos un nuevo aliado fuerte para tu negocio.'
    },
  },
  new_value_chain_partner: {
    tipo: 'recomendacion_nueva',
    titulo: 'Nuevo socio de cadena de valor',
    detalle: (e) => {
      const tipo = pickString(e.payload.type)
      const target = pickString(e.payload.targetId)
      if (tipo && target) return `${capitalize(tipo)} potencial: ${target}`
      if (tipo) return `Detectamos un ${tipo} potencial`
      return 'Aparecido un socio en tu cadena de valor.'
    },
  },
  new_cluster_member: {
    tipo: 'miembro_cluster_nuevo',
    titulo: 'Nuevo miembro en tu cluster',
    detalle: (e) => {
      const newCompany = pickString(e.payload.newCompanyId)
      return newCompany
        ? `${newCompany} se unió a tu cluster.`
        : 'Una nueva empresa entró a tu cluster.'
    },
  },
}

export function mapBrainAgentEventToConectorEvent(
  event: BrainAgentEvent,
): ConectorEvent {
  const copy = COPY_BY_TYPE[event.eventType] ?? FALLBACK
  return {
    id: event.id,
    timestamp: relativeTime(event.createdAt),
    tipo: copy.tipo,
    titulo: copy.titulo,
    detalle: copy.detalle(event),
  }
}

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function capitalize(value: string): string {
  if (value.length === 0) return value
  return value[0].toUpperCase() + value.slice(1)
}

function relativeTime(isoDate: string): string {
  const created = new Date(isoDate).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - created)
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'hace un momento'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `hace ${diffHour} h`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `hace ${diffDay} d`
  return new Date(isoDate).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  })
}
