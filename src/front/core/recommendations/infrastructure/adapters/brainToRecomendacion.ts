import type {
  BrainGroupedRecommendationsResponse,
  BrainRecommendationView,
} from '@/core/shared/infrastructure/brain/brainClient'
import type { Ancla, Recomendacion } from '@/app/[locale]/app/_data/types'

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

function buildAnclas(view: BrainRecommendationView): Ancla[] {
  return view.reasons.slice(0, 3).map((r) => ({
    tipo: 'sector_compatible',
    valor: r.description ?? r.feature,
  }))
}

function buildRazon(view: BrainRecommendationView): string {
  if (view.explanation && view.explanation.trim().length > 0) {
    return view.explanation
  }
  if (view.reasons.length === 0) {
    return 'Conexión sugerida por el sistema.'
  }
  return view.reasons.map((r) => r.description).join(' · ')
}

export function mapBrainViewToRecomendacion(
  view: BrainRecommendationView,
): Recomendacion | null {
  if (!view.targetCompany) return null
  const company = view.targetCompany
  return {
    id: view.id,
    target: {
      id: company.id,
      iniciales: buildIniciales(company.razonSocial),
      nombre: company.razonSocial,
      sector: `CIIU ${company.ciiuSeccion}${company.ciiu}`,
      barrio: company.municipio,
      origen: 'formal',
      avatarColor: pickAvatarColor(company.id),
      descripcion: view.explanation ?? undefined,
    },
    tipoRelacion: view.relationType,
    score: Math.round(view.score * 100),
    razon: buildRazon(view),
    estado: 'nueva',
    anclas: buildAnclas(view),
  }
}

export function mapBrainGroupedToRecomendaciones(
  grouped: BrainGroupedRecommendationsResponse,
): Recomendacion[] {
  const flat: BrainRecommendationView[] = [
    ...grouped.proveedor,
    ...grouped.cliente,
    ...grouped.aliado,
    ...grouped.referente,
  ]
  return flat
    .map(mapBrainViewToRecomendacion)
    .filter((r): r is Recomendacion => r !== null)
}
