import { setRequestLocale } from 'next-intl/server'

import { LandingClient } from './_components/landing/landing-client'
import { LandingFooter } from './_components/landing/landing-footer'
import { LandingHeader } from './_components/landing/landing-header'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="bg-bg text-text flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <LandingClient />
      </main>
      <LandingFooter />
    </div>
  )
}
