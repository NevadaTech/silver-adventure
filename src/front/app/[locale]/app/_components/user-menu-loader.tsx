'use client'

import { useCurrentUser } from '@/core/users/infrastructure/hooks/useCurrentUser'

import { UserMenu } from './user-menu'

/**
 * Client-only wrapper para el `UserMenu` del header.
 *
 * Encapsula la suscripción a `useCurrentUser` (SWR) sin obligar al header
 * entero a ser un Client Component. Mientras carga muestra un skeleton
 * compacto del mismo tamaño que el botón del menú para evitar layout shift.
 */
export function UserMenuLoader() {
  const { user, isLoading } = useCurrentUser()

  if (isLoading || !user) {
    return (
      <div aria-hidden className="flex items-center gap-2 rounded-xl px-2 py-1">
        <span className="bg-surface-hover h-9 w-9 animate-pulse rounded-md" />
        <span className="bg-surface-hover hidden h-4 w-24 animate-pulse rounded sm:inline-block" />
      </div>
    )
  }

  return <UserMenu currentUser={user} />
}
