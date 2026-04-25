import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

import { ThemeProvider } from '@/core/shared/infrastructure/theme/ThemeProvider'
import { SWRProvider } from '@/core/shared/infrastructure/swr/SWRProvider'
import { routing } from '@/i18n/routing'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

/**
 * Generate static params for all supported locales.
 * This enables static generation for each locale at build time.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

/**
 * Locale Layout — wraps every page with i18n + theme + data providers.
 *
 * Provider stack (outside → inside):
 * 1. NextIntlClientProvider — i18n messages available to all client components
 * 2. ThemeProvider — dark/light/system theme via next-themes
 * 3. SWRProvider — global SWR config with axios fetcher
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  // Validate locale
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }

  // Enable static rendering for this locale
  setRequestLocale(locale)

  // Load all messages for the current locale
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider>
        <SWRProvider>{children}</SWRProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  )
}
