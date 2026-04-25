import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Silver Adventure',
  description: 'Hexagonal Architecture • Next.js 16 • Supabase',
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
