'use client'

import { useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { z } from 'zod'

import { RegistroProgress } from './registro-progress'
import { RegistroStepBusiness } from './registro-step-business'
import { RegistroStepConfirm } from './registro-step-confirm'
import { RegistroStepContact } from './registro-step-contact'
import { RegistroSuccess } from './registro-success'
import {
  businessStepSchema,
  confirmStepSchema,
  contactStepSchema,
  emptyRegistroData,
} from './schema'
import type { RegistroDataPartial } from './schema'

type Step = 1 | 2 | 3
type StepErrors = Record<string, string>

const stepSchemas: Record<Step, z.ZodTypeAny> = {
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
  const [submitted, setSubmitted] = useState(false)
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
    setStep((prev) => (prev < 3 ? ((prev + 1) as Step) : prev))
  }

  function handleBack() {
    setErrors({})
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))
  }

  function handleSubmit() {
    if (!validateCurrentStep()) return
    startTransition(() => {
      setTimeout(() => {
        setSubmitted(true)
      }, 800)
    })
  }

  if (submitted) {
    return <RegistroSuccess data={data} />
  }

  return (
    <div className="flex flex-col gap-8">
      <RegistroProgress currentStep={step} labels={labels} />

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

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="bg-primary text-primary-text hover:bg-primary-hover inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-8 font-semibold shadow-lg shadow-black/5 transition-all hover:shadow-xl active:scale-95 sm:w-auto"
            >
              {t('next')}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
}
