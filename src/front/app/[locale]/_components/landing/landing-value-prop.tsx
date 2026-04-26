import Image from 'next/image'
import { BadgeCheck, Hand, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Props = {
  currentStep: 1 | 2 | 3 | 4
  totalSteps: number
}

export function LandingValueProp({ currentStep, totalSteps }: Props) {
  const t = useTranslations('Landing.Hero')
  const progress = Math.round((currentStep / totalSteps) * 100)

  return (
    <section className="flex flex-col gap-6">
      <span className="bg-secondary-soft text-primary inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase">
        <Hand className="h-4 w-4" strokeWidth={2.4} />
        {t('eyebrow')}
      </span>

      <h1 className="font-display text-text text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl lg:text-[48px]">
        {t('titleStart')}{' '}
        <span className="text-secondary">{t('titleHighlight')}</span>
      </h1>

      <p className="text-text-secondary max-w-xl text-lg leading-relaxed">
        {t('description')}
      </p>

      <span className="border-secondary-soft bg-secondary-soft/40 text-primary inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold">
        <BadgeCheck className="text-secondary h-4 w-4" strokeWidth={2.4} />
        {t('socialProof')}
      </span>

      <div className="group relative overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(0,172,193,0.12)]">
        <Image
          src="/landing/emprendedor-samario.png"
          alt={t('visualAlt')}
          width={1280}
          height={720}
          priority
          className="aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
        />
        <div className="absolute inset-x-6 bottom-6 space-y-2 text-white">
          <span className="bg-surface/90 text-primary border-secondary-soft inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-widest uppercase backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
            {t('visualEyebrow')}
          </span>
          <p className="font-display text-2xl font-extrabold tracking-tight drop-shadow-sm sm:text-3xl">
            {t('visualTitle')}
          </p>
          <p className="max-w-md text-sm opacity-95 drop-shadow-sm">
            {t('visualSubtitle')}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4">
        <div className="bg-bg-tertiary h-2 flex-1 overflow-hidden rounded-full">
          <div
            className="bg-secondary h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
        <span className="text-primary text-sm font-bold">
          {t('stepIndicator', { current: currentStep, total: totalSteps })}
        </span>
      </div>
    </section>
  )
}
