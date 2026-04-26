import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

import { ThemeToggle } from '@/core/shared/infrastructure/theme/ThemeToggle'

export function LandingHeader() {
  const t = useTranslations('Landing.Header')

  return (
    <header className="bg-bg/85 border-border-soft sticky top-0 z-50 flex h-16 w-full items-center border-b shadow-[0_4px_24px_rgba(0,172,193,0.06)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label={t('logoLabel')}
        >
          <span className="bg-primary text-primary-text font-display grid h-9 w-9 place-items-center rounded-lg text-sm font-extrabold shadow-sm">
            C
          </span>
          <span className="font-display text-text text-lg font-extrabold tracking-tight">
            Ruta C <span className="text-secondary">Conecta</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-text-secondary hover:text-secondary hidden text-sm font-semibold transition-colors sm:inline"
          >
            {t('login')}
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
