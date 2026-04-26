import { useTranslations } from 'next-intl'

import type { Business } from '../_data/mock-business'

type Props = {
  business: Business
}

export function MiNegocioTabGeneral({ business }: Props) {
  const t = useTranslations('App.MiNegocio.general')
  const tFields = useTranslations('App.MiNegocio.general.fields')

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title={t('datos.title')}>
        <Row label={tFields('nombre')} value={business.nombre} />
        <Row label={tFields('nit')} value={business.nit} />
        <Row label={tFields('sector')} value={business.sector} />
        <Row label={tFields('etapa')} value={business.etapa} />
        <Row
          label={tFields('anios')}
          value={t('aniosTemplate', { count: business.aniosOperando })}
        />
        <Row
          label={tFields('descripcion')}
          value={business.descripcion}
          multiline
        />
      </Card>

      <Card title={t('ubicacion.title')}>
        <Row label={tFields('municipio')} value={business.municipio} />
        <Row label={tFields('barrio')} value={business.barrio} />
        <Row label={tFields('direccion')} value={business.direccion} />
        <Row label={tFields('whatsapp')} value={`+57 ${business.whatsapp}`} />
        <Row label={tFields('email')} value={business.email} />
      </Card>
    </div>
  )
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-surface border-border-soft rounded-2xl border p-6">
      <h3 className="font-display text-text mb-4 text-base font-bold">
        {title}
      </h3>
      <dl className="flex flex-col gap-3 text-sm">{children}</dl>
    </section>
  )
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <div
      className={
        multiline
          ? 'flex flex-col gap-1'
          : 'flex items-baseline justify-between gap-3'
      }
    >
      <dt className="text-text-muted text-xs tracking-wider uppercase">
        {label}
      </dt>
      <dd
        className={`text-text font-medium ${multiline ? 'leading-relaxed' : 'text-right'}`}
      >
        {value}
      </dd>
    </div>
  )
}
