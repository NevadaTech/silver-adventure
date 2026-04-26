import { useTranslations } from 'next-intl'

import type { EstadoReco } from '../_data/types'

const styleByEstado: Record<EstadoReco, string> = {
  nueva: 'bg-primary text-primary-text',
  vista: 'bg-secondary-soft text-secondary-hover',
  guardada: 'bg-accent/30 text-accent-text',
  descartada: 'bg-bg-tertiary text-text-muted',
}

type Props = {
  estado: EstadoReco
}

export function RecoStatusPill({ estado }: Props) {
  const t = useTranslations('App.Recomendaciones.statuses')

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${styleByEstado[estado]}`}
    >
      {t(estado)}
    </span>
  )
}
