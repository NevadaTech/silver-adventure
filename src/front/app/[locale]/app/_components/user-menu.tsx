'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useRouter } from '@/i18n/navigation'

import type { CurrentUser } from '../_data/types'

type Props = {
  currentUser: CurrentUser
}

export function UserMenu({ currentUser }: Props) {
  const t = useTranslations('App.Header.userMenu')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hover:bg-surface-hover inline-flex items-center gap-2 rounded-xl px-2 py-1 transition-colors"
      >
        <span className="bg-secondary text-secondary-text grid h-9 w-9 place-items-center rounded-md text-sm font-bold">
          {currentUser.iniciales}
        </span>
        <span className="text-text hidden text-sm font-semibold sm:inline">
          {currentUser.nombre}
        </span>
        <ChevronDown
          className={`text-text-secondary h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="bg-surface border-border-soft animate-fade-up absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border shadow-lg shadow-black/5"
        >
          <header className="border-border-soft border-b px-4 py-3">
            <p className="text-text text-sm font-semibold">
              {currentUser.nombre}
            </p>
            <p className="text-text-muted text-xs">{currentUser.empresa}</p>
          </header>
          <button
            type="button"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="text-text-secondary hover:bg-surface-hover hover:text-text flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors"
          >
            <User className="h-4 w-4" />
            {t('profile')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              router.push('/')
            }}
            className="text-error hover:bg-error/5 flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
