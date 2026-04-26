import { setRequestLocale } from 'next-intl/server'

import { LandingHeader } from '../_components/landing/landing-header'

import { LoginForm } from './_components/login-form'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="bg-bg-secondary text-text flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex flex-1 items-center justify-center px-6 pt-24 pb-12">
        <LoginForm />
      </main>
    </div>
  )
}
