import { setRequestLocale } from 'next-intl/server'

import { MiNegocioHeader } from '../_components/mi-negocio-header'
import { MiNegocioTabs } from '../_components/mi-negocio-tabs'
import { mockBusiness } from '../_data/mock-business'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function MiNegocioPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
      <MiNegocioHeader business={mockBusiness} />
      <MiNegocioTabs business={mockBusiness} />
    </div>
  )
}
