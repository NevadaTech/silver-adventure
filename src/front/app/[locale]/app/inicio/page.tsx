import { setRequestLocale } from 'next-intl/server'

import { InicioContent } from '../_components/inicio-content'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function InicioPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <InicioContent />
}
