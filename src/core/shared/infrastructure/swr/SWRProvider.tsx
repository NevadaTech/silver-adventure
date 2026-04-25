'use client'

import { SWRConfig } from 'swr'

import { fetcher } from './fetcher'

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
