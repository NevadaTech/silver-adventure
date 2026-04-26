import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'

import { ConexionesList } from '../_components/conexiones-list'
import { mockConexiones } from '../_data/mock-conexiones'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function ConexionesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <ConexionesContent />
}

function ConexionesContent() {
  const t = useTranslations('App.Conexiones')
  const total = mockConexiones.length

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="font-display text-text text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t('title')}
        </h1>
        <p className="text-text-secondary mt-2 text-sm">
          {t('subtitleTemplate', { count: total })}
        </p>
      </header>

      <ConexionesList />
    </div>
  )
}
