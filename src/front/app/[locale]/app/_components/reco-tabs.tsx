'use client'

import { useTranslations } from 'next-intl'

import type { TipoRelacion } from '../_data/types'

export type TabValue = 'todas' | TipoRelacion

type Props = {
  active: TabValue
  counts: Record<TabValue, number>
  onChange: (value: TabValue) => void
}

const order: TabValue[] = [
  'todas',
  'proveedor',
  'aliado',
  'cliente',
  'referente',
]

export function RecoTabs({ active, counts, onChange }: Props) {
  const t = useTranslations('App.Recomendaciones.tabs')

  return (
    <nav
      aria-label="Filtrar por tipo de relación"
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
