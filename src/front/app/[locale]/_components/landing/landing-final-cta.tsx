import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import { Reveal } from './reveal'

export function LandingFinalCta() {
  const t = useTranslations('Landing.FinalCta')

  return (
    <section className="bg-bg-secondary px-6 py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-text mb-5 text-3xl font-bold sm:text-5xl">
          {t('title')}
        </h2>
        <p className="text-text-secondary mb-10 text-lg">{t('subtitle')}</p>
        <Link
          href="/registro"
          className="bg-accent text-accent-text hover:bg-accent-hover group inline-flex min-h-[64px] items-center gap-3 rounded-full px-10 text-lg font-bold shadow-xl shadow-black/10 transition-transform hover:scale-105 active:scale-95"
        >
          {t('cta')}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  )
}
