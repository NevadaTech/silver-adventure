'use client'

import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { barriosSantaMarta } from './schema'
import type { RegistroDataPartial } from './schema'

type StepErrors = Partial<Record<'acceptTerms', string>>

type Props = {
  data: RegistroDataPartial
  errors: StepErrors
  onChange: (patch: RegistroDataPartial) => void
  onEdit: (step: 1 | 2) => void
}

export function RegistroStepConfirm({ data, errors, onChange, onEdit }: Props) {
  const t = useTranslations('Landing.Registro.Confirm')
  const tBusiness = useTranslations('Landing.Registro.Business')
  const tBusinessFields = useTranslations('Landing.Registro.Business.fields')
  const tCamara = useTranslations(
    'Landing.Registro.Business.fields.registradoCamara',
  )
  const tSectores = useTranslations('Landing.Registro.Business.sectores')
  const tTiempos = useTranslations('Landing.Registro.Business.tiemposOperando')
  const tContact = useTranslations('Landing.Registro.Contact')
  const tContactFields = useTranslations('Landing.Registro.Contact.fields')
  const tMunicipios = useTranslations('Landing.Registro.Contact.municipios')
  const tBarrios = useTranslations('Landing.Registro.Contact.barrios')
  const tErrors = useTranslations('Landing.Registro.Errors')

  const isSantaMarta = data.municipio === 'Santa Marta'
  const barrioInEnum =
    !!data.barrio &&
    barriosSantaMarta.includes(
      data.barrio as (typeof barriosSantaMarta)[number],
    )
  const barrioDisplay = data.barrio
    ? isSantaMarta && barrioInEnum
      ? tBarrios(data.barrio as (typeof barriosSantaMarta)[number])
      : data.barrio
    : '—'

  const camaraValue =
    typeof data.registradoCamara === 'boolean'
      ? data.registradoCamara
        ? `${tCamara('si.title')}${data.nit ? ` · NIT ${data.nit}` : ''}`
        : tCamara('no.title')
      : '—'

  return (
    <div className="animate-fade-up flex flex-col gap-5">
      <header className="mb-2">
        <span className="text-secondary text-xs font-bold uppercase tracking-wider">
          {t('eyebrow')}
        </span>
        <h2 className="font-display text-text mt-1 text-2xl font-bold sm:text-3xl">
          {t('title')}
        </h2>
        <p className="text-text-secondary mt-2 text-sm">{t('subtitle')}</p>
      </header>

      <SummaryCard
        title={tBusiness('title')}
        editLabel={t('edit')}
        onEdit={() => onEdit(1)}
        rows={[
          { label: tBusinessFields('nombre.label'), value: data.nombre ?? '—' },
          { label: tCamara('label'), value: camaraValue },
          {
            label: tBusinessFields('sector.label'),
            value: data.sector ? tSectores(data.sector) : '—',
          },
          {
            label: tBusinessFields('tiempoOperando.label'),
            value: data.tiempoOperando ? tTiempos(data.tiempoOperando) : '—',
          },
          {
            label: tBusinessFields('descripcion.label'),
            value: data.descripcion ?? '—',
            multiline: true,
          },
        ]}
      />

      <SummaryCard
        title={tContact('title')}
        editLabel={t('edit')}
        onEdit={() => onEdit(2)}
        rows={[
          {
            label: tContactFields('municipio.label'),
            value: data.municipio ? tMunicipios(data.municipio) : '—',
          },
          {
            label: tContactFields('barrio.label'),
            value: barrioDisplay,
          },
          {
            label: tContactFields('whatsapp.label'),
            value: data.whatsapp ? `+57 ${data.whatsapp}` : '—',
          },
          ...(data.email && data.email.trim()
            ? [
                {
                  label: tContactFields('email.label'),
                  value: data.email.trim(),
                },
              ]
            : []),
        ]}
      />

      <label className="bg-bg-secondary border-border-soft flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm">
        <input
          type="checkbox"
          checked={data.acceptTerms === true}
          onChange={(e) =>
            onChange({ acceptTerms: e.target.checked as unknown as true })
          }
          className="accent-secondary mt-0.5 h-5 w-5 flex-shrink-0"
        />
        <span className="text-text-secondary leading-relaxed">
          {t.rich('terms', {
            link: (chunks) => (
              <a
                href="#"
                className="text-secondary font-semibold hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </span>
      </label>
      {errors.acceptTerms ? (
        <p className="text-error -mt-3 text-xs font-medium" role="alert">
          {tErrors(errors.acceptTerms)}
        </p>
      ) : null}
    </div>
  )
}

type SummaryRow = { label: string; value: string; multiline?: boolean }

type SummaryCardProps = {
  title: string
  editLabel: string
  onEdit: () => void
  rows: SummaryRow[]
}

function SummaryCard({ title, editLabel, onEdit, rows }: SummaryCardProps) {
  return (
    <div className="bg-bg-secondary border-border-soft rounded-2xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-text text-base font-bold">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-secondary hover:text-secondary-hover inline-flex items-center gap-1 text-xs font-semibold transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          {editLabel}
        </button>
      </div>
      <dl className="flex flex-col gap-3 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className={
              row.multiline
                ? 'flex flex-col gap-1'
                : 'flex items-baseline justify-between gap-3'
            }
          >
            <dt className="text-text-muted text-xs uppercase tracking-wider">
              {row.label}
            </dt>
            <dd
              className={`text-text font-medium ${row.multiline ? '' : 'text-right'}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
