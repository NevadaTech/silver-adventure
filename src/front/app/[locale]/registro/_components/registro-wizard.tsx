'use client'

import { useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { z } from 'zod'

import { createSupabaseBrowserClient } from '@/core/shared/infrastructure/supabase/client'
import { RegistroProgress } from './registro-progress'
import { RegistroStepBusiness } from './registro-step-business'
import { RegistroStepConfirm } from './registro-step-confirm'
import { RegistroStepContact } from './registro-step-contact'
import { RegistroStepOtp } from './registro-step-otp'
import { RegistroSuccess } from './registro-success'
import {
  businessStepSchema,
  confirmStepSchema,
  contactStepSchema,
  emptyRegistroData,
} from './schema'
import type { RegistroDataPartial } from './schema'

type Step = 1 | 2 | 3 | 'otp' | 'success'
type StepErrors = Record<string, string>

function normalizeWhatsapp(phone: string | undefined): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\s/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.startsWith('57')) return `+${cleaned}`
  return `+57${cleaned}`
}

const stepSchemas: Record<1 | 2 | 3, z.ZodTypeAny> = {
  1: businessStepSchema,
  2: contactStepSchema,
  3: confirmStepSchema,
}

export function RegistroWizard() {
  const t = useTranslations('Landing.Registro')
  const tSteps = useTranslations('Landing.Registro.Steps')
  const tConfirm = useTranslations('Landing.Registro.Confirm')

  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<RegistroDataPartial>(emptyRegistroData)
  const [errors, setErrors] = useState<StepErrors>({})
  const [sessionId, setSessionId] = useState<string>('')
  const [apiError, setApiError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const labels: readonly [string, string, string] = [
    tSteps('business'),
    tSteps('contact'),
    tSteps('confirm'),
  ]

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
    if (step === 'otp' || step === 'success') return true
    const schema = stepSchemas[step as 1 | 2 | 3]
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
    setStep((prev) => {
      if (prev === 'otp' || prev === 'success') return prev
      return prev < 3 ? ((prev + 1) as Step) : prev
    })
  }

  function handleBack() {
    setErrors({})
    setApiError(null)
    setStep((prev) => {
      if (prev === 'otp') return 3
      if (prev === 'success') return 'otp'
      return prev > 1 ? ((prev - 1) as Step) : prev
    })
  }

  async function handleSubmit() {
    if (!validateCurrentStep()) return

    setApiError(null)
    startTransition(async () => {
      try {
        const whatsapp = normalizeWhatsapp(data.whatsapp)
        const payload = {
          businessName: data.nombre,
          sector: data.sector,
          yearsOfOperation: data.tiempoOperando,
          municipio: data.municipio,
          barrio: data.barrio,
          hasChamber: data.registradoCamara,
          nit: data.nit,
          whatsapp,
          email: data.email,
        }

        const response = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const result = await response.json()
          setApiError(result.error || 'Error al solicitar OTP')
          return
        }

        const result = await response.json()
        setSessionId(result.data.sessionId)
        setStep('otp')
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Error de conexión')
      }
    })
  }

  async function handleOtpResend() {
    setApiError(null)
    try {
      const whatsapp = normalizeWhatsapp(data.whatsapp)
      const payload = {
        businessName: data.nombre,
        sector: data.sector,
        yearsOfOperation: data.tiempoOperando,
        municipio: data.municipio,
        barrio: data.barrio,
        hasChamber: data.registradoCamara,
        nit: data.nit,
        whatsapp,
        email: data.email,
      }

      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = await response.json()
        setApiError(result.error || 'Error al reenviar OTP')
        return
      }

      const result = await response.json()
      setSessionId(result.data.sessionId)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error de conexión')
    }
  }

  async function handleOtpSuccess(tokens: {
    accessToken: string
    refreshToken: string
  }) {
    try {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      })
      setStep('success')
    } catch (_err) {
      setApiError('Error al establecer sesión')
    }
  }

  if (step === 'success') {
    return <RegistroSuccess data={data} />
  }

  const displayStep: 1 | 2 | 3 = typeof step === 'string' ? 3 : step

  const isFormStep = typeof step === 'number'

  return (
    <div className="flex flex-col gap-8">
      {isFormStep && (
        <RegistroProgress currentStep={displayStep} labels={labels} />
      )}

      <div
        key={step}
        className="bg-surface border-border-soft rounded-3xl border p-6 shadow-sm sm:p-10"
      >
        {step === 1 ? (
          <RegistroStepBusiness
            data={data}
            errors={errors}
            onChange={patchData}
          />
        ) : null}
        {step === 2 ? (
          <RegistroStepContact
            data={data}
            errors={errors}
            onChange={patchData}
          />
        ) : null}
        {step === 3 ? (
          <RegistroStepConfirm
            data={data}
            errors={errors}
            onChange={patchData}
            onEdit={(target) => {
              setErrors({})
              setStep(target)
            }}
          />
        ) : null}
        {step === 'otp' ? (
          <RegistroStepOtp
            sessionId={sessionId}
            whatsapp={data.whatsapp || ''}
            onSuccess={handleOtpSuccess}
            onResend={handleOtpResend}
          />
        ) : null}

        {apiError && isFormStep && (
          <div className="bg-error/10 text-error mb-4 rounded-lg border border-red-200 p-3 text-sm">
            {apiError}
          </div>
        )}

        {
          <div className="border-border-soft mt-8 flex flex-col-reverse items-center justify-between gap-3 border-t pt-6 sm:flex-row">
            <button
              type="button"
              onClick={handleBack}
              disabled={(isFormStep && step === 1) || isPending}
              className="text-text-secondary hover:text-text inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back')}
            </button>

            {isFormStep && step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="bg-primary text-primary-text hover:bg-primary-hover inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-8 font-semibold shadow-lg shadow-black/5 transition-all hover:shadow-xl active:scale-95 sm:w-auto"
              >
                {t('next')}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : step === 3 ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="bg-accent text-accent-text hover:bg-accent-hover inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-8 font-bold shadow-xl shadow-black/10 transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 sm:w-auto"
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
            ) : null}
          </div>
        }
      </div>
    </div>
  )
}
