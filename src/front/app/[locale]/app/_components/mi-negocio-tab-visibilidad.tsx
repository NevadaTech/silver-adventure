import { Award, Bookmark, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { Business } from '../_data/mock-business'

type Props = {
  business: Business
}

export function MiNegocioTabVisibilidad({ business }: Props) {
  const t = useTranslations('App.MiNegocio.visibilidad')

  const { completitud } = business.visibilidad

  return (
    <section className="flex flex-col gap-6">
      <div className="bg-surface border-border-soft rounded-2xl border p-6">
        <header className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h3 className="font-display text-text text-base font-bold">
              {t('completitudTitle')}
            </h3>
            <p className="text-text-muted mt-1 text-sm">
              {t('completitudHint')}
            </p>
          </div>
          <p className="text-text font-display text-3xl leading-none font-extrabold">
            {completitud}%
          </p>
        </header>
        <div
          className="bg-bg-tertiary h-2 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={completitud}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-secondary h-full rounded-full transition-all"
            style={{ width: `${completitud}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          icon={<Users className="h-5 w-5" />}
          iconClass="bg-primary-soft text-primary"
          label={t('aparecesEn')}
          value={business.visibilidad.aparicionesEnClusters}
          unit={t('clustersUnit', {
            count: business.visibilidad.aparicionesEnClusters,
          })}
        />
        <Stat
          icon={<Award className="h-5 w-5" />}
          iconClass="bg-success/15 text-success"
          label={t('recomiendan')}
          value={business.visibilidad.empresasTeRecomiendan}
          unit={t('empresasUnit', {
            count: business.visibilidad.empresasTeRecomiendan,
          })}
        />
        <Stat
          icon={<Bookmark className="h-5 w-5" />}
          iconClass="bg-accent/30 text-accent-text"
          label={t('guardaron')}
          value={business.visibilidad.empresasGuardaronPerfil}
          unit={t('empresasUnit', {
            count: business.visibilidad.empresasGuardaronPerfil,
          })}
        />
      </div>
    </section>
  )
}

function Stat({
  icon,
  iconClass,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode
  iconClass: string
  label: string
  value: number
  unit: string
}) {
  return (
    <div className="bg-surface border-border-soft flex flex-col gap-3 rounded-2xl border p-5">
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl ${iconClass}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-text font-display text-3xl leading-none font-extrabold">
          {value}
        </p>
        <p className="text-text-muted mt-1 text-xs">{unit}</p>
      </div>
      <p className="text-text-secondary text-sm leading-relaxed">{label}</p>
    </div>
  )
}
