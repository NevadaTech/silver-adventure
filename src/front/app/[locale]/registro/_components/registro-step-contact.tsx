'use client'

import { useTranslations } from 'next-intl'

import { Field, SelectInput, TextInput, WhatsappInput } from './registro-fields'
import { barriosSantaMarta, municipiosMagdalena } from './schema'
import type { RegistroDataPartial } from './schema'

type StepErrors = Partial<
  Record<'municipio' | 'barrio' | 'whatsapp' | 'email', string>
>

type Props = {
  data: RegistroDataPartial
  errors: StepErrors
  onChange: (patch: RegistroDataPartial) => void
}

export function RegistroStepContact({ data, errors, onChange }: Props) {
  const t = useTranslations('Landing.Registro.Contact')
  const tFields = useTranslations('Landing.Registro.Contact.fields')
  const tMunicipios = useTranslations('Landing.Registro.Contact.municipios')
  const tBarrios = useTranslations('Landing.Registro.Contact.barrios')
  const tErrors = useTranslations('Landing.Registro.Errors')

  const municipioOptions = municipiosMagdalena.map((value) => ({
    value,
    label: tMunicipios(value),
  }))

  const barrioOptions = barriosSantaMarta.map((value) => ({
    value,
    label: tBarrios(value),
  }))

  const isSantaMarta = data.municipio === 'Santa Marta'

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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label={tFields('municipio.label')}
          hint={tFields('municipio.hint')}
          error={errors.municipio ? tErrors(errors.municipio) : undefined}
          required
        >
          {(id, hasError) => (
            <SelectInput
              id={id}
              name="municipio"
              value={data.municipio ?? ''}
              onChange={(e) => {
                const next = e.target
                  .value as (typeof municipiosMagdalena)[number]
                onChange({
                  municipio: next,
                  // reset barrio when toggling between SM and others
                  ...(next === 'Santa Marta'
                    ? barriosSantaMarta.includes(
                        (data.barrio ??
                          '') as (typeof barriosSantaMarta)[number],
                      )
                      ? {}
                      : { barrio: '' }
                    : isSantaMarta
                      ? { barrio: '' }
                      : {}),
                })
              }}
              options={municipioOptions}
              placeholder={tFields('municipio.placeholder')}
              hasError={hasError}
            />
          )}
        </Field>

        <Field
          label={tFields('barrio.label')}
          hint={tFields('barrio.hint')}
          error={errors.barrio ? tErrors(errors.barrio) : undefined}
          required
        >
          {(id, hasError) =>
            isSantaMarta ? (
              <SelectInput
                id={id}
                name="barrio"
                value={data.barrio ?? ''}
                onChange={(e) => onChange({ barrio: e.target.value })}
                options={barrioOptions}
                placeholder={tFields('barrio.placeholderSelect')}
                hasError={hasError}
              />
            ) : (
              <TextInput
                id={id}
                name="barrio"
                value={data.barrio ?? ''}
                onChange={(e) => onChange({ barrio: e.target.value })}
                placeholder={tFields('barrio.placeholder')}
                hasError={hasError}
                maxLength={60}
              />
            )
          }
        </Field>
      </div>

      <Field
        label={tFields('whatsapp.label')}
        hint={tFields('whatsapp.hint')}
        error={errors.whatsapp ? tErrors(errors.whatsapp) : undefined}
        required
      >
        {(id, hasError) => (
          <WhatsappInput
            id={id}
            name="whatsapp"
            value={data.whatsapp ?? ''}
            onChange={(e) => onChange({ whatsapp: e.target.value })}
            placeholder={tFields('whatsapp.placeholder')}
            hasError={hasError}
            autoComplete="tel"
          />
        )}
      </Field>

      <Field
        label={tFields('email.label')}
        hint={tFields('email.hint')}
        error={errors.email ? tErrors(errors.email) : undefined}
      >
        {(id, hasError) => (
          <TextInput
            id={id}
            name="email"
            type="email"
            value={data.email ?? ''}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder={tFields('email.placeholder')}
            hasError={hasError}
            autoComplete="email"
            maxLength={120}
          />
        )}
      </Field>
    </div>
  )
}
