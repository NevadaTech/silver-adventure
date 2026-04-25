'use client'

import useSWR from 'swr'

/**
 * DTO que viene del Route Handler GET /api/users.
 * NO es la entidad de dominio — es la representación serializada para el wire.
 */
export interface UserDTO {
  id: string
  name: string
  createdAt: string
}

interface UsersResponse {
  data: UserDTO[]
}

/**
 * useUsers — SWR hook para consumir /api/users
 *
 * Hace GET al Route Handler, que internamente usa el use case GetUsers.
 * El fetcher global (configurado en SWRProvider) se encarga del fetch + error handling.
 *
 * Retorna: { users, isLoading, error }
 */
export function useUsers() {
  const { data, error, isLoading } = useSWR<UsersResponse>('/api/users')

  return {
    users: data?.data ?? [],
    isLoading,
    error: error as Error | undefined,
  }
}
