import { ShoppingBag } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { Business } from '../_data/mock-business'

type Props = {
  business: Business
}

export function MiNegocioTabProductos({ business }: Props) {
  const t = useTranslations('App.MiNegocio.productos')

  return (
    <section className="bg-surface border-border-soft flex flex-col gap-5 rounded-2xl border p-6">
      <header className="flex items-center gap-3">
        <span className="bg-accent/30 text-accent-text grid h-10 w-10 place-items-center rounded-xl">
          <ShoppingBag className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-text text-base font-bold">
            {t('title')}
          </h3>
          <p className="text-text-muted mt-0.5 text-sm">
            {t('subtitleTemplate', { count: business.productos.length })}
          </p>
        </div>
      </header>

      <ul className="flex flex-wrap gap-2">
        {business.productos.map((producto) => (
          <li
            key={producto}
            className="bg-secondary-soft/40 text-secondary-hover rounded-full px-3 py-1.5 text-xs font-semibold"
          >
            {producto}
          </li>
        ))}
      </ul>

      <p className="text-text-secondary border-border-soft border-t pt-4 text-sm leading-relaxed">
        {business.descripcion}
      </p>
    </section>
  )
}
