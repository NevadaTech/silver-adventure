import { Check, Circle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { Business } from '../_data/mock-business'

type Props = {
  business: Business
}

export function MiNegocioTabProgramas({ business }: Props) {
  const t = useTranslations('App.MiNegocio.programas')

  return (
    <section className="bg-surface border-border-soft rounded-2xl border p-6">
      <header className="mb-5">
        <h3 className="font-display text-text text-base font-bold">
          {t('title')}
        </h3>
        <p className="text-text-muted mt-1 text-sm">{t('subtitle')}</p>
      </header>

      <ul className="divide-border-soft flex flex-col divide-y">
        {business.programas.map((programa) => {
          const Icon = programa.activo ? Check : Circle
          return (
            <li key={programa.nombre} className="flex items-start gap-4 py-4">
              <span
                className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${
                  programa.activo
                    ? 'bg-success/15 text-success'
                    : 'bg-bg-tertiary text-text-muted'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-text text-sm font-bold">
                    {programa.nombre}
                  </p>
                  <span
                    className={`text-xs font-semibold ${
                      programa.activo ? 'text-success' : 'text-text-muted'
                    }`}
                  >
                    {programa.activo
                      ? t('desdeTemplate', { year: programa.desde })
                      : t('inactivo')}
                  </span>
                </div>
                <p className="text-text-secondary mt-1 text-sm leading-relaxed">
                  {programa.descripcion}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
