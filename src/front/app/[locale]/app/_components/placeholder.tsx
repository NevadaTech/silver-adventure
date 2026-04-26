import { ArrowRight, Construction } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

type Props = {
  title: string
  body: string
}

export function Placeholder({ title, body }: Props) {
  const t = useTranslations('App.Placeholder')

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-16 text-center">
      <div className="bg-secondary-soft text-secondary-hover mb-6 grid h-20 w-20 place-items-center rounded-3xl">
        <Construction className="h-10 w-10" strokeWidth={2.2} />
      </div>
      <h1 className="font-display text-text mb-3 text-3xl font-extrabold tracking-tight">
        {title}
      </h1>
      <p className="text-text-secondary mb-10 max-w-xl text-base leading-relaxed">
        {body}
      </p>
      <Link
        href="/app/recomendaciones"
        className="bg-primary text-primary-text hover:bg-primary-hover inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg shadow-black/5 transition-all hover:shadow-xl active:scale-95"
      >
        {t('recomendacionesCta')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
