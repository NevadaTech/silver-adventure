'use client'

import { useTranslations } from 'next-intl'

import { useUsers } from '@/core/users/infrastructure/hooks/useUsers'

/**
 * UserList — Client Component (Presentational + Container)
 *
 * Consume /api/users via SWR hook. Maneja los 3 estados:
 * loading, error, y data.
 *
 * Es un Client Component porque necesita hooks (useSWR + useTranslations).
 */
export function UserList() {
  const { users, isLoading, error } = useUsers()
  const t = useTranslations('UserList')

  if (isLoading) {
    return <p className="text-text-muted">{t('loading')}</p>
  }

  if (error) {
    return (
      <p className="text-error">{t('error', { message: error.message })}</p>
    )
  }

  if (users.length === 0) {
    return <p className="text-text-muted">{t('empty')}</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {users.map((user) => (
        <li
          key={user.id}
          className="border-border bg-surface rounded-lg border px-5 py-4"
        >
          <p className="text-text text-lg font-medium">{user.name}</p>
          <p className="text-text-secondary text-sm">
            {t('createdAt', {
              date: new Date(user.createdAt).toLocaleDateString(),
            })}
          </p>
        </li>
      ))}
    </ul>
  )
}
