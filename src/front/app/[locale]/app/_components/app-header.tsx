import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import { mockCurrentUser } from '../_data/mock-user'

import { AppNavLink } from './app-nav-link'
import { UserMenu } from './user-menu'

export function AppHeader() {
  const t = useTranslations('App.Header')

  const navItems = [
    { href: '/app/inicio', label: t('nav.inicio') },
    { href: '/app/recomendaciones', label: t('nav.recomendaciones') },
    { href: '/app/mi-cluster', label: t('nav.cluster') },
    { href: '/app/conexiones', label: t('nav.conexiones') },
    { href: '/app/mi-negocio', label: t('nav.negocio') },
  ]

  return (
    <header className="bg-surface border-border-soft sticky top-0 z-50 border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href="/app/recomendaciones"
          className="flex items-center"
          aria-label={t('logo')}
        >
          <span className="font-display text-text text-lg font-light tracking-tight">
            ruta <span className="text-secondary font-extrabold">· c ·</span>{' '}
            conecta
          </span>
        </Link>

        <nav
          aria-label={t('navLabel')}
          className="hidden items-center gap-6 md:flex"
        >
          {navItems.map((item) => (
            <AppNavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('notifications')}
            className="text-text-secondary hover:bg-surface-hover hover:text-text grid h-9 w-9 place-items-center rounded-full transition-colors"
          >
            <Bell className="h-5 w-5" />
          </button>
          <UserMenu currentUser={mockCurrentUser} />
        </div>
      </div>
    </header>
  )
}
