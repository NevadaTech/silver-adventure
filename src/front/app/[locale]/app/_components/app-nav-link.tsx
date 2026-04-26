'use client'

import { usePathname, Link } from '@/i18n/navigation'

type Props = {
  href: string
  label: string
}

export function AppNavLink({ href, label }: Props) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center border-b-2 text-sm font-semibold transition-colors ${
        isActive
          ? 'border-primary text-text'
          : 'text-text-secondary hover:text-text border-transparent'
      }`}
    >
      {label}
    </Link>
  )
}
