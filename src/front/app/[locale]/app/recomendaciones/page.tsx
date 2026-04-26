import { Filter, ArrowDownUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'

import { RecoFilters } from '../_components/reco-filters'
import { RecoHeader } from '../_components/reco-header'
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
        <RecoHeader />
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
