'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

type Props = {
  children: React.ReactNode
}

/**
 * Theme Provider — infrastructure adapter for next-themes.
 *
 * Known issue: next-themes 0.4.6 injects an inline <script> via
 * React.createElement which triggers a console warning in React 19 / Next.js 16:
 * "Encountered a script tag while rendering React component."
 * This is cosmetic — theming works correctly. PR #386 tracks the fix.
 *
 * Config:
 * - attribute="class" → adds .dark/.light to <html>, which Tailwind v4 reads
 *   via @custom-variant dark (&:where(.dark, .dark *))
 * - defaultTheme="system" → respects OS preference out of the box
 * - enableSystem → enables system preference detection
 * - disableTransitionOnChange → prevents flash of wrong-colored transition
 *
 * To change the palette, edit CSS variables in globals.css.
 * The ThemeProvider just toggles the class — all visual theming is CSS-only.
 */
export function ThemeProvider({ children }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
