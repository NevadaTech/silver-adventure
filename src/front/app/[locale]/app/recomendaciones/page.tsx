import { Filter, ArrowDownUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'

import { mockRecomendaciones } from '../_data/mock-recomendaciones'
import { mockCurrentUser } from '../_data/mock-user'

import { RecoFilters } from '../_components/reco-filters'
import { RecoTable } from '../_components/reco-table'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function RecomendacionesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <RecomendacionesContent />
}

function RecomendacionesContent() {
  const t = useTranslations('App.Recomendaciones')

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-text text-3xl font-extrabold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-text-secondary mt-2 text-sm">
            {t('subtitleTemplate', {
              count: mockRecomendaciones.length,
              empresa: mockCurrentUser.empresa,
              tiempo: t('lastUpdated'),
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="border-border-soft text-text-secondary hover:bg-surface-hover hover:text-text inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Filter className="h-4 w-4" />
            {t('filtrar')}
          </button>
          <button
            type="button"
            className="border-border-soft text-text-secondary hover:bg-surface-hover hover:text-text inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
          >
            <ArrowDownUp className="h-4 w-4" />
            {t('ordenarScore')}
          </button>
        </div>
      </header>

      <RecoFilters />
      <RecoTable />
    </div>
  )
}
