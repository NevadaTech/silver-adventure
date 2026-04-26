import {
  Archive,
  Clock,
  Network,
  PauseCircle,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { EstadoConexion } from '../_data/types'

type Props = {
  counts: Record<EstadoConexion, number>
}

const order: { key: EstadoConexion; icon: LucideIcon; iconClass: string }[] = [
  {
    key: 'active',
    icon: Network,
    iconClass: 'bg-success/15 text-success',
  },
  {
    key: 'pending',
    icon: Clock,
    iconClass: 'bg-accent/30 text-accent-text',
  },
  {
    key: 'paused',
    icon: PauseCircle,
    iconClass: 'bg-bg-tertiary text-text-secondary',
  },
  {
    key: 'archived',
    icon: Archive,
    iconClass: 'bg-bg-tertiary text-text-muted',
  },
]

export function ConexionesStats({ counts }: Props) {
  const t = useTranslations('App.Conexiones.stats')

  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {order.map(({ key, icon: Icon, iconClass }) => (
        <li
          key={key}
          className="bg-surface border-border-soft flex items-start gap-3 rounded-2xl border p-4"
        >
          <span
            className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${iconClass}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-text font-display text-2xl leading-none font-extrabold">
              {counts[key]}
            </p>
            <p className="text-text-muted mt-1 text-xs">{t(key)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
