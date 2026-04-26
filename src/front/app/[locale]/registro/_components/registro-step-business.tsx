'use client'

import { useTranslations } from 'next-intl'

import {
  ChoiceCards,
  Field,
  SelectInput,
  TextArea,
  TextInput,
  type ChoiceOption,
} from './registro-fields'
import { sectores, tiemposOperando } from './schema'
import type { RegistroDataPartial } from './schema'

type StepErrors = Partial<
  Record<
    | 'nombre'
    | 'registradoCamara'
    | 'nit'
    | 'sector'
    | 'tiempoOperando'
    | 'descripcion',
    string
  >
>

type Props = {
  data: RegistroDataPartial
  errors: StepErrors
  onChange: (patch: RegistroDataPartial) => void
}

const MAX_DESCRIPCION = 280

export function RegistroStepBusiness({ data, errors, onChange }: Props) {
  const t = useTranslations('Landing.Registro.Business')
  const tFields = useTranslations('Landing.Registro.Business.fields')
  const tSectores = useTranslations('Landing.Registro.Business.sectores')
  const tTiempos = useTranslations('Landing.Registro.Business.tiemposOperando')
  const tCamara = useTranslations(
    'Landing.Registro.Business.fields.registradoCamara',
  )
  const tErrors = useTranslations('Landing.Registro.Errors')

  const sectorOptions = sectores.map((value) => ({
    value,
    label: tSectores(value),
  }))
  const tiempoOptions = tiemposOperando.map((value) => ({
    value,
    label: tTiempos(value),
  }))

  const camaraOptions: ChoiceOption<'si' | 'no'>[] = [
    {
      value: 'si',
      label: tCamara('si.title'),
      description: tCamara('si.description'),
    },
    {
      value: 'no',
      label: tCamara('no.title'),
      description: tCamara('no.description'),
    },
  ]

  const descripcion = data.descripcion ?? ''
  const remaining = MAX_DESCRIPCION - descripcion.length

  return (
    <div className="animate-fade-up flex flex-col gap-5">
      <header className="mb-2">
        <span className="text-secondary text-xs font-bold uppercase tracking-wider">
          {t('eyebrow')}
        </span>
        <h2 className="font-display text-text mt-1 text-2xl font-bold sm:text-3xl">
          {t('title')}
        </h2>
      </header>

      <Field
        label={tFields('nombre.label')}
        hint={tFields('nombre.hint')}
        error={errors.nombre ? tErrors(errors.nombre) : undefined}
        required
      >
        {(id, hasError) => (
          <TextInput
            id={id}
            name="nombre"
            value={data.nombre ?? ''}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder={tFields('nombre.placeholder')}
            hasError={hasError}
            maxLength={80}
            autoComplete="organization"
          />
        )}
      </Field>

      <Field
        label={tCamara('label')}
        error={
          errors.registradoCamara ? tErrors(errors.registradoCamara) : undefined
        }
        required
      >
        {(_id, hasError) => (
          <ChoiceCards
            name="registradoCamara"
            options={camaraOptions}
            value={
              typeof data.registradoCamara === 'boolean'
                ? data.registradoCamara
                  ? 'si'
                  : 'no'
                : undefined
            }
            onChange={(v) =>
              onChange({
                registradoCamara: v === 'si',
                ...(v === 'no' ? { nit: '' } : {}),
              })
            }
            hasError={hasError}
          />
        )}
      </Field>

      {data.registradoCamara === true ? (
        <div className="animate-fade-up">
          <Field
            label={tFields('nit.label')}
            hint={tFields('nit.hint')}
            error={errors.nit ? tErrors(errors.nit) : undefined}
            required
          >
            {(id, hasError) => (
              <TextInput
                id={id}
                name="nit"
                value={data.nit ?? ''}
                onChange={(e) => onChange({ nit: e.target.value })}
                placeholder={tFields('nit.placeholder')}
                hasError={hasError}
                inputMode="numeric"
                maxLength={15}
              />
            )}
          </Field>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label={tFields('sector.label')}
          error={errors.sector ? tErrors(errors.sector) : undefined}
          required
        >
          {(id, hasError) => (
            <SelectInput
              id={id}
              name="sector"
              value={data.sector ?? ''}
              onChange={(e) =>
                onChange({
                  sector: e.target.value as (typeof sectores)[number],
                })
              }
              options={sectorOptions}
              placeholder={tFields('sector.placeholder')}
              hasError={hasError}
            />
          )}
        </Field>

        <Field
          label={tFields('tiempoOperando.label')}
          error={
            errors.tiempoOperando ? tErrors(errors.tiempoOperando) : undefined
          }
          required
        >
          {(id, hasError) => (
            <SelectInput
              id={id}
              name="tiempoOperando"
              value={data.tiempoOperando ?? ''}
              onChange={(e) =>
                onChange({
                  tiempoOperando: e.target
                    .value as (typeof tiemposOperando)[number],
                })
              }
              options={tiempoOptions}
              placeholder={tFields('tiempoOperando.placeholder')}
              hasError={hasError}
            />
          )}
        </Field>
      </div>

      <Field
        label={tFields('descripcion.label')}
        hint={`${descripcion.length}/${MAX_DESCRIPCION}`}
        error={errors.descripcion ? tErrors(errors.descripcion) : undefined}
        required
      >
        {(id, hasError) => (
          <TextArea
            id={id}
            name="descripcion"
            value={descripcion}
            onChange={(e) =>
              onChange({
                descripcion: e.target.value.slice(0, MAX_DESCRIPCION),
              })
            }
            placeholder={tFields('descripcion.placeholder')}
            hasError={hasError}
            rows={4}
          />
        )}
      </Field>

      {remaining < 30 ? (
        <p className="text-text-muted text-xs">
          {tFields('descripcion.warning', { remaining })}
        </p>
      ) : null}
    </div>
  )
}
