'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { z } from 'zod'

import { useRouter } from '@/i18n/navigation'
import { createSupabaseBrowserClient } from '@/core/shared/infrastructure/supabase/client'

import { RegistroStepBusiness } from './registro-step-business'
import { RegistroStepConfirm } from './registro-step-confirm'
import { RegistroStepContact } from './registro-step-contact'
import { RegistroStepPassword } from './registro-step-password'
import {
  businessStepSchema,
  confirmStepSchema,
  contactStepSchema,
  emptyRegistroData,
  passwordStepSchema,
} from './schema'
import type { RegistroDataPartial } from './schema'

const REDIRECT_DELAY_MS = 1500
const REDIRECT_TARGET = '/app/recomendaciones'

type Step = 1 | 2 | 3 | 4
type StepErrors = Record<string, string>

const stepSchemas: Record<Step, z.ZodTypeAny> = {
  1: businessStepSchema,
  2: contactStepSchema,
  3: confirmStepSchema,
  4: passwordStepSchema,
}

function normalizeWhatsapp(phone: string | undefined): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\s/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('57')) return `+${cleaned}`
  return `+57${cleaned}`
}

type Props = {
  step?: Step
  onStepChange?: (next: Step) => void
}

export function RegistroWizard({ step: stepProp, onStepChange }: Props = {}) {
  const t = useTranslations('Landing.Registro')
  const tConfirm = useTranslations('Landing.Registro.Confirm')
  const tSuccess = useTranslations('Landing.Registro.Success')
  const router = useRouter()

  // Patrón controlled/uncontrolled: si el padre pasa `step`, esa es la fuente
  // de verdad y `internalStep` queda dormido. Si no, gestionamos el paso aquí.
  const [internalStep, setInternalStep] = useState<Step>(1)
  const step = stepProp ?? internalStep

  const setStep = (next: Step) => {
    if (stepProp == null) setInternalStep(next)
    onStepChange?.(next)
  }

  const [data, setData] = useState<RegistroDataPartial>(emptyRegistroData)
  const [errors, setErrors] = useState<StepErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function patchData(patch: RegistroDataPartial) {
    setData((prev) => ({ ...prev, ...patch }))
    if (Object.keys(patch).some((k) => errors[k])) {
      setErrors((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(patch)) delete next[key]
        return next
      })
    }
  }

  function validateCurrentStep(): boolean {
    const schema = stepSchemas[step]
    const result = schema.safeParse(data)
    if (result.success) {
      setErrors({})
      return true
    }
    const next: StepErrors = {}
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? '_')
      if (!next[key]) next[key] = issue.message
    }
    setErrors(next)
    return false
  }

  function handleNext() {
    if (!validateCurrentStep()) return
    if (step < 4) setStep((step + 1) as Step)
  }

  function handleBack() {
    setErrors({})
    setApiError(null)
    if (step > 1) setStep((step - 1) as Step)
  }

  function handleSubmit() {
    if (!validateCurrentStep()) return

    setApiError(null)
    startTransition(async () => {
      try {
        const payload = {
          businessName: data.nombre,
          sector: data.sector,
          yearsOfOperation: data.tiempoOperando,
          municipio: data.municipio,
          barrio: data.barrio,
          hasChamber: data.registradoCamara,
          nit: data.nit,
          whatsapp: data.whatsapp
            ? normalizeWhatsapp(data.whatsapp)
            : undefined,
          email: data.email,
          password: data.password,
          descripcion: data.descripcion,
        }

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const result = await response.json()
          setApiError(result.error || 'Error al crear la cuenta')
          return
        }

        const result = await response.json()
        const supabase = createSupabaseBrowserClient()
        await supabase.auth.setSession({
          access_token: result.data.accessToken,
          refresh_token: result.data.refreshToken,
        })
        setSubmitted(true)
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Error de conexión')
      }
    })
  }

  useEffect(() => {
    if (!submitted) return
    const timeoutId = setTimeout(() => {
      router.push(REDIRECT_TARGET)
    }, REDIRECT_DELAY_MS)
    return () => clearTimeout(timeoutId)
  }, [submitted, router])

  if (submitted) {
    return (
      <div className="bg-surface border-border-soft animate-fade-up rounded-2xl border p-8 text-center shadow-[0_8px_32px_rgba(0,172,193,0.08)] sm:p-10">
        <div className="bg-primary-soft/40 text-primary mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full">
          <CheckCircle2 className="h-9 w-9" strokeWidth={2.4} />
        </div>
        <h2 className="font-display text-text mb-2 text-2xl font-bold">
          {tSuccess('title')}
        </h2>
        <p className="text-text-secondary mb-6 text-sm">
          {tSuccess('redirecting')}
        </p>
        <Loader2 className="text-secondary mx-auto h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div
      key={step}
      className="bg-surface border-border-soft animate-fade-up rounded-2xl border p-6 shadow-[0_8px_32px_rgba(0,172,193,0.08)] sm:p-8"
    >
      {step === 1 ? (
        <RegistroStepBusiness
          data={data}
          errors={errors}
          onChange={patchData}
        />
      ) : null}
      {step === 2 ? (
        <RegistroStepContact data={data} errors={errors} onChange={patchData} />
      ) : null}
      {step === 3 ? (
        <RegistroStepConfirm
          data={data}
          errors={errors}
          onChange={patchData}
          onEdit={(target) => {
            setErrors({})
            setStep(target as Step)
          }}
        />
      ) : null}
      {step === 4 ? (
        <RegistroStepPassword
          data={data}
          errors={errors}
          onChange={patchData}
        />
      ) : null}

      {apiError && (
        <div className="bg-error/10 text-error mt-6 rounded-lg border border-red-200 p-3 text-sm">
          {apiError}
        </div>
      )}

      <div className="border-border-soft mt-8 flex flex-col-reverse items-center justify-between gap-3 border-t pt-6 sm:flex-row">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1 || isPending}
          className="text-text-secondary hover:text-text inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="bg-secondary text-secondary-text hover:bg-secondary-hover inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-8 font-semibold shadow-lg shadow-cyan-500/20 transition-all hover:shadow-xl active:scale-95 sm:w-auto"
          >
            {t('next')}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-secondary text-secondary-text hover:bg-secondary-hover inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-8 font-bold shadow-lg shadow-cyan-500/30 transition-all hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tConfirm('sending')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {tConfirm('cta')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
