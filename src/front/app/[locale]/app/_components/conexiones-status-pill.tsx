import { useTranslations } from 'next-intl'

import type { EstadoConexion } from '../_data/types'

const styleByEstado: Record<EstadoConexion, string> = {
  active: 'bg-success/15 text-success',
  pending: 'bg-accent/30 text-accent-text',
  paused: 'bg-bg-tertiary text-text-secondary',
  archived: 'bg-bg-tertiary text-text-muted',
}

const dotByEstado: Record<EstadoConexion, string> = {
  active: 'bg-success',
  pending: 'bg-accent',
  paused: 'bg-text-muted',
  archived: 'bg-text-muted',
}

type Props = {
  estado: EstadoConexion
}

export function ConexionesStatusPill({ estado }: Props) {
  const t = useTranslations('App.Conexiones.statuses')

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${styleByEstado[estado]}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${dotByEstado[estado]}`}
      />
      {t(estado)}
    </span>
  )
}
