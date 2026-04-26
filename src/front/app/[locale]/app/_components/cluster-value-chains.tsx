import { ArrowRight, Handshake, ShoppingCart, Truck } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import type { ValueChainAdj, ValueChainTipo } from '../_data/types'

const tipoIcon: Record<
  ValueChainTipo,
  React.ComponentType<{ className?: string }>
> = {
  proveedor: Truck,
  aliado: Handshake,
  cliente: ShoppingCart,
}

const tipoStyle: Record<ValueChainTipo, string> = {
  proveedor: 'bg-success/15 text-success',
  aliado: 'bg-secondary-soft text-secondary-hover',
  cliente: 'bg-error/15 text-error',
}

type Props = {
  cadenas: ValueChainAdj[]
}

export function ClusterValueChains({ cadenas }: Props) {
  const t = useTranslations('App.MiCluster.valueChains')
  const tTipo = useTranslations('App.MiCluster.valueChains.tipos')

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="font-display text-text text-xl font-bold">
          {t('title')}
        </h2>
        <p className="text-text-muted mt-1 text-sm">{t('subtitle')}</p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cadenas.map((cadena) => {
          const Icon = tipoIcon[cadena.tipo]
          return (
            <li
              key={cadena.tipo}
              className="bg-surface border-border-soft flex flex-col gap-4 rounded-2xl border p-5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${tipoStyle[cadena.tipo]}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-text-muted text-xs font-bold tracking-wider uppercase">
                    {tTipo(cadena.tipo)}
                  </p>
                  <p className="text-text font-display text-base font-bold">
                    {t('countTemplate', { count: cadena.count })}
                  </p>
                </div>
              </div>

              <p className="text-text-secondary text-sm leading-relaxed">
                {cadena.etiqueta}
              </p>

              <div className="flex items-center justify-between">
                <ul className="flex -space-x-2">
                  {cadena.topIniciales.map((iniciales) => (
                    <li
                      key={iniciales}
                      className="bg-bg-tertiary text-text border-surface grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold"
                    >
                      {iniciales}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/app/recomendaciones"
                  className="text-secondary hover:text-secondary-hover inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                >
                  {t('cta')}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
