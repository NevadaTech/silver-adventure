import { UserPlus, Network, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Reveal } from './reveal'

const steps = [
  { id: 'register', icon: UserPlus },
  { id: 'connect', icon: Network },
  { id: 'whatsapp', icon: MessageCircle },
] as const

export function LandingSteps() {
  const t = useTranslations('Landing.Steps')

  return (
    <section id="como-funciona" className="bg-bg px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-14 max-w-3xl">
          <span className="text-secondary mb-3 inline-block text-xs font-bold uppercase tracking-wider">
            {t('eyebrow')}
          </span>
          <h2 className="font-display text-text mb-4 text-3xl font-bold sm:text-4xl">
            {t('title')}
          </h2>
          <p className="text-text-secondary text-lg">{t('subtitle')}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <Reveal
                key={step.id}
                delay={index * 120}
                className="bg-surface border-border-soft relative flex flex-col gap-4 rounded-2xl border p-8"
              >
                <span className="text-primary-soft font-display absolute right-6 top-4 select-none text-7xl font-extrabold leading-none opacity-60">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="bg-primary text-primary-text grid h-12 w-12 place-items-center rounded-xl">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <h3 className="font-display text-text text-xl font-bold">
                  {t(`${step.id}.title`)}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {t(`${step.id}.description`)}
                </p>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
