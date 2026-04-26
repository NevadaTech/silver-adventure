import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans } from 'next/font/google'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Ruta C Conecta — Cámara de Comercio de Santa Marta',
  description:
    'Motor inteligente de clusters empresariales y recomendaciones accionables para Santa Marta.',
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
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
