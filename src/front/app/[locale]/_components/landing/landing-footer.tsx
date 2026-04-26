import { useTranslations } from 'next-intl'

import { Imagotipo } from '@/core/shared/infrastructure/brand/Imagotipo'

export function LandingFooter() {
  const t = useTranslations('Landing.Footer')

  return (
    <footer
      id="equipo"
      className="border-border-soft bg-bg-secondary text-text-secondary border-t px-6 py-12"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <Imagotipo className="text-primary h-7 w-auto" />
          <span className="font-display text-text text-lg font-extrabold">
            Ruta C <span className="text-secondary">Conecta</span>
          </span>
        </div>

        <nav
          aria-label="Enlaces legales"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
        >
          <a href="#" className="hover:text-text transition-colors">
            {t('linkPrivacy')}
          </a>
          <a href="#" className="hover:text-text transition-colors">
            {t('linkTerms')}
          </a>
          <a href="#" className="hover:text-text transition-colors">
            {t('linkSupport')}
          </a>
        </nav>

        <p className="text-text-muted text-sm">{t('copyright')}</p>
        <p className="text-text-muted text-xs">{t('credits')}</p>
      </div>
    </footer>
  )
}
