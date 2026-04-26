import { setRequestLocale } from 'next-intl/server'

import { LandingHeader } from './_components/landing/landing-header'
import { LandingHero } from './_components/landing/landing-hero'
import { LandingSegments } from './_components/landing/landing-segments'
import { LandingSteps } from './_components/landing/landing-steps'
import { LandingCamaraCta } from './_components/landing/landing-camara-cta'
import { LandingFinalCta } from './_components/landing/landing-final-cta'
import { LandingFooter } from './_components/landing/landing-footer'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="bg-bg text-text flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex flex-col">
        <LandingHero />
        <LandingSegments />
        <LandingSteps />
        <LandingCamaraCta />
        <LandingFinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
