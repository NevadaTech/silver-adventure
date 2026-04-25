'use client'

import { useLocale, useTranslations } from 'next-intl'

import { usePathname, useRouter } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'

/**
 * LocaleSwitcher — toggles between supported locales.
 *
 * Uses next-intl's navigation utilities so the locale
 * is properly injected into the URL path.
 */
export function LocaleSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('Locale')

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as Locale })
  }

  return (
    <div className="flex items-center gap-1">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          disabled={loc === locale}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            loc === locale
              ? 'border-primary bg-primary text-primary-text'
              : 'border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text'
          }`}
          aria-label={t('switchTo')}
          title={t(loc as 'en' | 'es')}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
