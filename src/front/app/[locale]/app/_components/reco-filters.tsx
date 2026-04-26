'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

const chips = ['estados', 'sector', 'etapa', 'distancia'] as const
const toggle = 'formales' as const

export function RecoFilters() {
  const t = useTranslations('App.Recomendaciones.filters')
  const [onlyFormales, setOnlyFormales] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((key) => (
        <button
          key={key}
          type="button"
          className="border-border-soft bg-surface text-text-secondary hover:border-secondary/40 hover:text-text inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {t(key)}
          <ChevronDown className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        aria-pressed={onlyFormales}
        onClick={() => setOnlyFormales((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          onlyFormales
            ? 'bg-primary border-primary text-primary-text'
            : 'border-border-soft bg-surface text-text-secondary hover:border-secondary/40 hover:text-text'
        }`}
      >
        {t(toggle)}
      </button>
    </div>
  )
}
