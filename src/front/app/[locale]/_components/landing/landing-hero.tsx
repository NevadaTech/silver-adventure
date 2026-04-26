import { ArrowRight, BadgeCheck, Zap, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

export function LandingHero() {
  const t = useTranslations('Landing.Hero')

  return (
    <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden px-6 pb-20 pt-32">
      <div
        aria-hidden
        className="from-primary-soft/40 via-bg to-bg absolute inset-0 -z-10 bg-gradient-to-b"
      />
      <div
        aria-hidden
        className="bg-secondary/20 absolute left-1/4 top-1/3 -z-10 h-72 w-72 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-accent/30 absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full blur-3xl"
      />

      <div className="mx-auto max-w-4xl text-center">
        <span
          className="bg-secondary-soft text-secondary-hover animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider"
          style={{ animationDelay: '50ms' }}
        >
          {t('eyebrow')}
        </span>

        <h1
          className="font-display text-text animate-fade-up mb-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl"
          style={{ animationDelay: '150ms' }}
        >
          {t('titleStart')}{' '}
          <span className="text-secondary">{t('titleHighlight')}</span>
        </h1>

        <p
          className="text-text-secondary animate-fade-up mx-auto mb-10 max-w-2xl text-lg leading-relaxed"
          style={{ animationDelay: '250ms' }}
        >
          {t('description')}
        </p>

        <div
          className="animate-fade-up flex flex-col items-center justify-center gap-4 sm:flex-row"
          style={{ animationDelay: '350ms' }}
        >
          <Link
            href="/registro"
            className="bg-primary text-primary-text hover:bg-primary-hover inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-8 font-semibold shadow-lg shadow-black/5 transition-all hover:shadow-xl active:scale-95"
          >
            {t('ctaPrimary')}
            <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href="#como-funciona"
            className="border-border text-text hover:bg-surface-hover inline-flex min-h-[56px] items-center justify-center rounded-xl border-2 px-6 font-semibold transition-colors"
          >
            {t('ctaSecondary')}
          </a>
        </div>

        <div
          className="border-border-soft text-text-secondary animate-fade-up mt-16 grid grid-cols-1 gap-4 border-t pt-8 text-sm md:grid-cols-3"
          style={{ animationDelay: '450ms' }}
        >
          <span className="flex items-center justify-center gap-2">
            <BadgeCheck className="text-secondary h-5 w-5" strokeWidth={2.2} />
            <span className="font-semibold">{t('badge1')}</span>
          </span>
          <span className="flex items-center justify-center gap-2">
            <Zap className="text-secondary h-5 w-5" strokeWidth={2.2} />
            <span className="font-semibold">{t('badge2')}</span>
          </span>
          <span className="flex items-center justify-center gap-2">
            <Users className="text-secondary h-5 w-5" strokeWidth={2.2} />
            <span className="font-semibold">{t('badge3')}</span>
          </span>
        </div>
      </div>
    </section>
  )
}
