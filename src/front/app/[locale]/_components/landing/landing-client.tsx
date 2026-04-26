'use client'

import { useState } from 'react'

import { RegistroWizard } from '../../registro/_components/registro-wizard'
import { LandingValueProp } from './landing-value-prop'

type Step = 1 | 2 | 3

const TOTAL_STEPS = 3

export function LandingClient() {
  const [step, setStep] = useState<Step>(1)

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-12 px-6 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16">
      <div className="animate-fade-up lg:sticky lg:top-24">
        <LandingValueProp currentStep={step} totalSteps={TOTAL_STEPS} />
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
        <RegistroWizard step={step} onStepChange={setStep} />
      </div>
    </div>
  )
}
