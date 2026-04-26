import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  BrainGroupedRecommendationsResponse,
  BrainRecommendationView,
} from '@/core/shared/infrastructure/brain/brainClient'
import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import type { Database } from '@/core/shared/infrastructure/supabase/database.types'

const RELATION_KEYS = ['proveedor', 'cliente', 'aliado', 'referente'] as const

const FEATURE_CLASE = 'mismo_ciiu_clase'
const FEATURE_DIVISION = 'mismo_ciiu_division'

interface TaxonomyMaps {
  codeToTitulo: Map<string, string>
  divisionToTitulo: Map<string, string>
}

const EMPTY_MAPS: TaxonomyMaps = {
  codeToTitulo: new Map(),
  divisionToTitulo: new Map(),
}

/**
 * Enriquece la respuesta del brain con los nombres legibles del CIIU.
 *
 * El brain devuelve códigos crudos (`ciiu`, `ciiuDivision`) y descripciones
 * con esos códigos pegados ("Misma clase CIIU 5611"). Pensando en el usuario
 * final, este helper:
 *
 * 1. Junta los códigos únicos que aparecen en `targetCompany` y en las
 *    `reasons` con feature `mismo_ciiu_clase` / `mismo_ciiu_division`.
 * 2. Hace UNA sola query batch a `ciiu_taxonomy`.
 * 3. Devuelve un nuevo `BrainGroupedRecommendationsResponse` con
 *    `targetCompany.ciiuTitulo` poblado y las descripciones de esos dos
 *    features reescritas con el nombre + código entre paréntesis.
 *
 * Si la query a Supabase falla, loguea un warning y devuelve la respuesta
 * sin enriquecer (degradación elegante — la UI sigue funcionando con los
 * códigos crudos).
 */
export async function enrichWithCiiuTitles(
  grouped: BrainGroupedRecommendationsResponse,
  supabase: SupabaseClient<Database>,
): Promise<BrainGroupedRecommendationsResponse> {
  const { codes, divisions } = collectCiiuRefs(grouped)
  if (codes.size === 0 && divisions.size === 0) return grouped

  const maps = await fetchTaxonomyMaps(supabase, codes, divisions)
  if (maps.codeToTitulo.size === 0 && maps.divisionToTitulo.size === 0) {
    return grouped
  }

  return enrichResponse(grouped, maps)
}

function collectCiiuRefs(grouped: BrainGroupedRecommendationsResponse): {
  codes: Set<string>
  divisions: Set<string>
} {
  const codes = new Set<string>()
  const divisions = new Set<string>()

  for (const key of RELATION_KEYS) {
    for (const view of grouped[key]) {
      if (view.targetCompany) {
        if (view.targetCompany.ciiu) codes.add(view.targetCompany.ciiu)
        if (view.targetCompany.ciiuDivision)
          divisions.add(view.targetCompany.ciiuDivision)
      }
      for (const r of view.reasons) {
        if (r.value == null) continue
        const value = String(r.value)
        if (r.feature === FEATURE_CLASE) codes.add(value)
        if (r.feature === FEATURE_DIVISION) divisions.add(value)
      }
    }
  }

  return { codes, divisions }
}

async function fetchTaxonomyMaps(
  supabase: SupabaseClient<Database>,
  codes: Set<string>,
  divisions: Set<string>,
): Promise<TaxonomyMaps> {
  if (codes.size === 0 && divisions.size === 0) return EMPTY_MAPS

  // Dos queries en paralelo: una por `code` y otra por `division`. Probamos
  // antes con `.or()` + `.in()` pero PostgREST no parsea bien los paréntesis
  // anidados cuando los valores `in` contienen comas. Dos round-trips contra
  // una tabla pequeña (502 filas, indexada por code) es más confiable y
  // sigue siendo una sola "request batch" desde el punto de vista del UX.
  const codesPromise =
    codes.size > 0
      ? supabase
          .from('ciiu_taxonomy')
          .select('code, titulo_actividad')
          .in('code', [...codes])
      : Promise.resolve({ data: [] as TaxonomyCodeRow[], error: null })

  const divisionsPromise =
    divisions.size > 0
      ? supabase
          .from('ciiu_taxonomy')
          .select('division, titulo_division')
          .in('division', [...divisions])
      : Promise.resolve({ data: [] as TaxonomyDivisionRow[], error: null })

  const [codesRes, divisionsRes] = await Promise.all([
    codesPromise,
    divisionsPromise,
  ])

  if (codesRes.error) {
    serverLogger.warn(
      '[enrichWithCiiuTitles] Failed to fetch ciiu_taxonomy by code',
      codesRes.error,
    )
  }
  if (divisionsRes.error) {
    serverLogger.warn(
      '[enrichWithCiiuTitles] Failed to fetch ciiu_taxonomy by division',
      divisionsRes.error,
    )
  }

  const codeToTitulo = new Map<string, string>()
  for (const row of (codesRes.data ?? []) as TaxonomyCodeRow[]) {
    if (!codeToTitulo.has(row.code)) {
      codeToTitulo.set(row.code, row.titulo_actividad)
    }
  }

  const divisionToTitulo = new Map<string, string>()
  for (const row of (divisionsRes.data ?? []) as TaxonomyDivisionRow[]) {
    // Una división se repite en múltiples filas (una por code). Nos quedamos
    // con la primera — el `titulo_division` es idéntico en todas.
    if (!divisionToTitulo.has(row.division)) {
      divisionToTitulo.set(row.division, row.titulo_division)
    }
  }

  return { codeToTitulo, divisionToTitulo }
}

interface TaxonomyCodeRow {
  code: string
  titulo_actividad: string
}

interface TaxonomyDivisionRow {
  division: string
  titulo_division: string
}

function enrichResponse(
  grouped: BrainGroupedRecommendationsResponse,
  maps: TaxonomyMaps,
): BrainGroupedRecommendationsResponse {
  const next = {
    partial: grouped.partial,
  } as BrainGroupedRecommendationsResponse
  for (const key of RELATION_KEYS) {
    next[key] = grouped[key].map((view) => enrichView(view, maps))
  }
  return next
}

function enrichView(
  view: BrainRecommendationView,
  maps: TaxonomyMaps,
): BrainRecommendationView {
  const targetCompany = view.targetCompany
    ? {
        ...view.targetCompany,
        ciiuTitulo:
          maps.codeToTitulo.get(view.targetCompany.ciiu) ??
          view.targetCompany.ciiuTitulo,
      }
    : null

  const reasons = view.reasons.map((r) => {
    if (r.value == null) return r
    const value = String(r.value)
    if (r.feature === FEATURE_CLASE) {
      const titulo = maps.codeToTitulo.get(value)
      return titulo
        ? { ...r, description: `Misma clase: ${titulo} (CIIU ${value})` }
        : r
    }
    if (r.feature === FEATURE_DIVISION) {
      const titulo = maps.divisionToTitulo.get(value)
      return titulo
        ? { ...r, description: `Misma división: ${titulo} (CIIU ${value})` }
        : r
    }
    return r
  })

  return { ...view, targetCompany, reasons }
}

// Exportamos las claves usadas internamente para los tests.
export const __testing = {
  RELATION_KEYS,
  FEATURE_CLASE,
  FEATURE_DIVISION,
}
