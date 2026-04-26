'use client'

import useSWR from 'swr'

import type { CurrentUser } from '@/app/[locale]/app/_data/types'

export interface MeApiResponse {
  user: {
    id: string
    name: string
    email: string | null
    sector: string | null
    barrio: string | null
    municipio: string | null
    companyId: string | null
  }
}

interface UseCurrentUserResult {
  user: CurrentUser | undefined
  isLoading: boolean
  error: Error | undefined
}

/**
 * Computa iniciales a partir del nombre del negocio. Usamos las primeras
 * letras de las primeras dos palabras alfabéticas; si no hay, usamos las
 * dos primeras letras del string. Suficiente para un avatar.
 */
function buildIniciales(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-záéíóúñ]/i.test(w[0]))
  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

export function useCurrentUser(): UseCurrentUserResult {
  const { data, error, isLoading } = useSWR<MeApiResponse>('/api/me', {
    // El usuario actual no cambia mientras dura la sesión: evitamos refetch
    // en focus para reducir ruido en la UI.
    revalidateOnFocus: false,
  })

  const user: CurrentUser | undefined = data
    ? {
        id: data.user.id,
        nombre: data.user.name,
        empresa: data.user.name,
        iniciales: buildIniciales(data.user.name),
        sector: data.user.sector ?? '',
        barrio: data.user.barrio ?? '',
      }
    : undefined

  return {
    user,
    isLoading,
    error: error instanceof Error ? error : undefined,
  }
}
