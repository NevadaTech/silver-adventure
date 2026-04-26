'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import type { Business } from '../_data/mock-business'

import { MiNegocioTabGeneral } from './mi-negocio-tab-general'
import { MiNegocioTabProductos } from './mi-negocio-tab-productos'
import { MiNegocioTabProgramas } from './mi-negocio-tab-programas'
import { MiNegocioTabVisibilidad } from './mi-negocio-tab-visibilidad'

type TabValue = 'general' | 'productos' | 'programas' | 'visibilidad'

const order: TabValue[] = ['general', 'productos', 'programas', 'visibilidad']

type Props = {
  business: Business
}

export function MiNegocioTabs({ business }: Props) {
  const t = useTranslations('App.MiNegocio.tabs')

  const [active, setActive] = useState<TabValue>('general')

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Secciones del perfil"
        className="border-border-soft flex items-center gap-6 overflow-x-auto border-b"
      >
        {order.map((value) => {
          const isActive = value === active
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActive(value)}
              className={`-mb-px inline-flex h-12 items-center border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-primary text-text'
                  : 'text-text-secondary hover:text-text border-transparent'
              }`}
            >
              {t(value)}
            </button>
          )
        })}
      </nav>

      <div key={active} className="animate-fade-up">
        {active === 'general' ? (
          <MiNegocioTabGeneral business={business} />
        ) : null}
        {active === 'productos' ? (
          <MiNegocioTabProductos business={business} />
        ) : null}
        {active === 'programas' ? (
          <MiNegocioTabProgramas business={business} />
        ) : null}
        {active === 'visibilidad' ? (
          <MiNegocioTabVisibilidad business={business} />
        ) : null}
      </div>
    </div>
  )
}
