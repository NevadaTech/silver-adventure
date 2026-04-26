'use client'

import { useTranslations } from 'next-intl'

import type { EstadoConexion } from '../_data/types'

export type ConexionTabValue = 'todas' | EstadoConexion

const order: ConexionTabValue[] = [
  'todas',
  'active',
  'pending',
  'paused',
  'archived',
]

type Props = {
  active: ConexionTabValue
  counts: Record<ConexionTabValue, number>
  onChange: (value: ConexionTabValue) => void
}

export function ConexionesTabs({ active, counts, onChange }: Props) {
  const t = useTranslations('App.Conexiones.tabs')

  return (
    <nav
      aria-label="Filtrar conexiones por estado"
      className="border-border-soft flex items-center gap-6 overflow-x-auto border-b"
    >
      {order.map((value) => {
        const isActive = value === active
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`-mb-px inline-flex h-12 items-center gap-2 border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              isActive
                ? 'border-primary text-text'
                : 'text-text-secondary hover:text-text border-transparent'
            }`}
          >
            {t(value)}
            <span
              className={`text-xs font-medium ${isActive ? 'text-secondary-hover' : 'text-text-muted'}`}
            >
              {counts[value]}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
