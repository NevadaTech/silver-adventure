import { Award, Bookmark, Pencil, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { Business } from '../_data/mock-business'

type Props = {
  business: Business
}

export function MiNegocioHeader({ business }: Props) {
  const t = useTranslations('App.MiNegocio')

  return (
    <header className="bg-surface border-border-soft flex flex-col gap-6 rounded-3xl border p-6 sm:p-8">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <span
          className={`grid h-20 w-20 flex-shrink-0 place-items-center rounded-2xl text-2xl font-extrabold ${business.avatarColor}`}
          aria-hidden
        >
          {business.iniciales}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-text text-2xl font-extrabold tracking-tight sm:text-3xl">
            {business.nombre}
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            {business.sector} · {business.etapa} · {business.barrio}
          </p>
        </div>
        <button
          type="button"
          className="border-border-soft text-text-secondary hover:bg-surface-hover hover:text-text inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl border px-4 text-sm font-semibold transition-colors sm:self-center"
        >
          <Pencil className="h-4 w-4" />
          {t('editar')}
        </button>
      </div>

      <dl className="border-border-soft grid grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-3">
        <Stat
          icon={<Sparkles className="h-4 w-4" />}
          iconClass="bg-secondary-soft text-secondary-hover"
          label={t('stats.completitud')}
          value={`${business.visibilidad.completitud}%`}
        />
        <Stat
          icon={<Award className="h-4 w-4" />}
          iconClass="bg-success/15 text-success"
          label={t('stats.recomiendan')}
          value={String(business.visibilidad.empresasTeRecomiendan)}
        />
        <Stat
          icon={<Bookmark className="h-4 w-4" />}
          iconClass="bg-accent/30 text-accent-text"
          label={t('stats.guardaron')}
          value={String(business.visibilidad.empresasGuardaronPerfil)}
        />
      </dl>
    </header>
  )
}

function Stat({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ReactNode
  iconClass: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${iconClass}`}
      >
        {icon}
      </span>
      <div>
        <dt className="text-text-muted text-xs font-semibold tracking-wider uppercase">
          {label}
        </dt>
        <dd className="text-text mt-0.5 text-base font-bold">{value}</dd>
      </div>
    </div>
  )
}
