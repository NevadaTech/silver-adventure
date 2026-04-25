import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'

import { UserList } from '@/core/users/infrastructure/components/UserList'
import { ThemeToggle } from '@/core/shared/infrastructure/theme/ThemeToggle'
import { LocaleSwitcher } from '@/core/shared/infrastructure/i18n/LocaleSwitcher'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <HomeContent />
}

/**
 * HomeContent — Server Component with translations.
 *
 * Separated so we can call useTranslations() synchronously
 * (it's a server-side hook, not async).
 */
function HomeContent() {
  const t = useTranslations('HomePage')

  return (
    <div className="bg-bg flex min-h-screen flex-col items-center justify-center font-sans">
      <main className="flex w-full max-w-lg flex-col gap-8 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-text text-3xl font-semibold tracking-tight">
            {t('title')}
          </h1>

          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <UserList />

        <p className="text-text-muted text-sm">{t('subtitle')}</p>
      </main>
    </div>
  )
}
