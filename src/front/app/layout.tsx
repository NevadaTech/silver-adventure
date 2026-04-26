import type { Metadata } from 'next'
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'

import { env } from '@/core/shared/infrastructure/env'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const APP_TITLE = 'Ruta C Conecta — Cámara de Comercio de Santa Marta'
const APP_DESCRIPTION =
  'Motor inteligente de clusters empresariales y recomendaciones accionables para Santa Marta.'

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  applicationName: 'Ruta C Conecta',
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'Ruta C Conecta',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },
}

/**
 * Root Layout — language-agnostic shell.
 *
 * Only responsible for:
 * - Loading fonts (CSS variables)
 * - Importing global CSS
 * - Providing the base <html> + <body> tags
 *
 * All locale-aware providers (i18n, theme, SWR) live in [locale]/layout.tsx.
 * `suppressHydrationWarning` is required by next-themes to avoid
 * the mismatch between server (no theme class) and client (theme class injected).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
