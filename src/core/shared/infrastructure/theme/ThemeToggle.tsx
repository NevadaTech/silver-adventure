'use client'

import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

/**
 * ThemeToggle — cycles through system → light → dark.
 *
 * Uses `resolvedTheme` (not `theme`) so that "system" correctly
 * shows the actual resolved value (light or dark) for the icon.
 *
 * `useSyncExternalStore` with diverging server/client snapshots
 * replaces the classic `useEffect(() => setMounted(true))` pattern.
 * React handles the hydration mismatch automatically — no extra
 * render cycle and fully compatible with React Compiler rules.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme()
  const t = useTranslations('Theme')
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  if (!mounted) {
    return (
      <button
        className="border-border bg-surface text-text-secondary rounded-md border px-3 py-1.5 text-sm"
        aria-label={t('toggle')}
        disabled
      >
        <span className="inline-block h-4 w-4" />
      </button>
    )
  }

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light')
    else if (theme === 'light') setTheme('dark')
    else setTheme('system')
  }

  const label =
    theme === 'system'
      ? t('system')
      : theme === 'light'
        ? t('light')
        : t('dark')

  return (
    <button
      onClick={cycleTheme}
      className="border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text rounded-md border px-3 py-1.5 text-sm transition-colors"
      aria-label={t('toggle')}
      title={label}
    >
      {resolvedTheme === 'dark' ? (
        // Moon icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 118.18 1.437a.75.75 0 01-.724.567z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        // Sun icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
        </svg>
      )}
    </button>
  )
}
