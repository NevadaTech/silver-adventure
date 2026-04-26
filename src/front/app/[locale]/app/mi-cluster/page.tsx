import { setRequestLocale } from 'next-intl/server'

import { MiClusterContent } from '../_components/mi-cluster-content'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function MiClusterPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
      <MiClusterContent />
    </div>
  )
}
