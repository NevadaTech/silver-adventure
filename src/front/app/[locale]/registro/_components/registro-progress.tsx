'use client'

import { Check } from 'lucide-react'

type Props = {
  currentStep: 1 | 2 | 3
  labels: readonly [string, string, string]
}

export function RegistroProgress({ currentStep, labels }: Props) {
  return (
    <ol className="mx-auto flex w-full max-w-md items-start justify-between">
      {labels.map((label, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3
        const isActive = stepNumber === currentStep
        const isComplete = stepNumber < currentStep
        const isLast = index === labels.length - 1

        return (
          <li
            key={label}
            className="flex flex-1 items-start gap-2"
            aria-current={isActive ? 'step' : undefined}
          >
            <div className="flex flex-col items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition-colors ${
                  isComplete
                    ? 'bg-secondary text-secondary-text'
                    : isActive
                      ? 'bg-primary text-primary-text ring-secondary/30 ring-4'
                      : 'bg-bg-tertiary text-text-muted'
                }`}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  stepNumber
                )}
              </span>
              <span
                className={`hidden text-xs font-semibold sm:inline ${
                  isActive || isComplete ? 'text-text' : 'text-text-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {!isLast ? (
              <div
                className={`mt-[15px] h-0.5 flex-1 rounded transition-colors ${
                  isComplete ? 'bg-secondary' : 'bg-border-soft'
                }`}
                aria-hidden
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
