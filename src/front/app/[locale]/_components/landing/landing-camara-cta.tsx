import { Headset, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function LandingCamaraCta() {
  const t = useTranslations('Landing.Camara')

  return (
    <section className="px-6 py-20">
      <div className="bg-primary text-primary-text mx-auto flex max-w-6xl flex-col items-center gap-8 overflow-hidden rounded-3xl p-10 md:flex-row md:p-14">
        <div className="flex-1">
          <span className="bg-secondary/20 text-secondary mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            {t('eyebrow')}
          </span>
          <h2 className="font-display mb-4 text-3xl font-bold sm:text-4xl">
            {t('title')}
          </h2>
          <p className="text-primary-soft mb-6 max-w-2xl text-lg leading-relaxed">
            {t('description')}
          </p>
          <a
            href="#equipo"
            className="bg-secondary-soft text-secondary-hover inline-flex min-h-[52px] items-center gap-2 rounded-xl px-6 font-semibold transition-transform active:scale-95"
          >
            <Headset className="h-5 w-5" />
            {t('cta')}
          </a>
        </div>
        <aside className="bg-secondary/10 ring-secondary/20 grid w-full place-items-center rounded-2xl p-8 ring-1 md:w-72 md:flex-shrink-0">
          <div className="text-center">
            <p className="text-secondary font-display text-6xl font-extrabold leading-none">
              {t('statValue')}
            </p>
            <p className="text-primary-soft mt-3 text-sm font-semibold uppercase tracking-wider">
              {t('statLabel')}
            </p>
            <p className="text-primary-text mt-4 text-sm italic">
              {t('quote')}
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
