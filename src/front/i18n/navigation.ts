import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Typed navigation utilities — use these instead of next/link and next/navigation
 * so that locale is always included in the URL automatically.
 *
 * - Link: drop-in replacement for next/link
 * - redirect: drop-in for next/navigation redirect
 * - usePathname: returns pathname WITHOUT locale prefix
 * - useRouter: locale-aware router
 * - getPathname: server-side pathname builder
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
