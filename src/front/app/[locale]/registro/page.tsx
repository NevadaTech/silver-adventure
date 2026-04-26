import { setRequestLocale } from 'next-intl/server'
import { useTranslations } from 'next-intl'

import { LandingHeader } from '../_components/landing/landing-header'
import { RegistroWizard } from './_components/registro-wizard'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function RegistroPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <RegistroContent />
}

function RegistroContent() {
  const t = useTranslations('Landing.Registro')

  return (
    <div className="bg-bg-secondary text-text flex min-h-screen flex-col">
      <LandingHeader />

      <main className="flex flex-1 flex-col items-center px-6 pb-20 pt-32">
        <div className="w-full max-w-2xl">
          <header className="animate-fade-up mb-10 text-center">
            <span className="bg-secondary-soft text-secondary-hover mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
              {t('eyebrow')}
            </span>
            <h1 className="font-display text-text mb-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t('pageTitle')}
            </h1>
            <p className="text-text-secondary mx-auto max-w-xl text-base">
              {t('pageSubtitle')}
            </p>
          </header>

          <RegistroWizard />
        </div>
      </main>
    </div>
  )
}
