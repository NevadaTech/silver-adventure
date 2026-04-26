'use client'

import { SWRConfig } from 'swr'

import { setTokenProvider } from '@/core/shared/infrastructure/http/httpClient'
import { createSupabaseBrowserClient } from '@/core/shared/infrastructure/supabase/client'

import { fetcher } from './fetcher'

// Enlazamos el httpClient con la sesión de Supabase a nivel de módulo
// (no dentro de useEffect) para evitar la race condition donde un useSWR
// dispara el fetch antes de que el efecto del provider corra. React ejecuta
// los efectos bottom-up: el child fetcher saldría sin Authorization.
// `typeof window` evita que esto se ejecute en SSR (este módulo carga en
// el server para marcar el boundary 'use client', pero solo queremos
// configurar el cliente en el browser).
if (typeof window !== 'undefined') {
  const supabase = createSupabaseBrowserClient()
  setTokenProvider(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  })
}

/**
 * SWR Provider — Client Component
 *
 * Envuelve la app con SWRConfig para que todos los useSWR
 * tengan el fetcher global configurado sin repetirlo.
 *
 * Va en el layout.tsx como children wrapper.
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  )
}
