import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

import { ThemeToggle } from '@/core/shared/infrastructure/theme/ThemeToggle'

export function LandingHeader() {
  const t = useTranslations('Landing.Header')

  return (
    <header className="bg-bg/80 border-border-soft fixed top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b px-6 backdrop-blur-md">
      <Link
        href="/"
        className="flex items-center gap-2"
        aria-label={t('logoLabel')}
      >
        <span className="bg-primary text-primary-text font-display grid h-8 w-8 place-items-center rounded-lg text-sm font-extrabold">
          C
        </span>
        <span className="font-display text-text text-lg font-extrabold tracking-tight">
          Ruta C <span className="text-secondary">Conecta</span>
        </span>
      </Link>

      <nav
        className="text-text-secondary hidden items-center gap-6 text-sm md:flex"
        aria-label={t('navLabel')}
      >
        <a href="#audiencias" className="hover:text-text transition-colors">
          {t('navAudiences')}
        </a>
        <a href="#como-funciona" className="hover:text-text transition-colors">
          {t('navHow')}
        </a>
        <a href="#equipo" className="hover:text-text transition-colors">
          {t('navTeam')}
        </a>
      </nav>

      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="text-text-secondary hover:text-text hidden text-sm font-semibold transition-colors sm:inline"
        >
          {t('login')}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
