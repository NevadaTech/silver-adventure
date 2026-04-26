import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

type Props = {
  centroide: string[]
}

export function ClusterTraits({ centroide }: Props) {
  const t = useTranslations('App.MiCluster.traits')

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <span className="bg-accent/30 text-accent-text grid h-10 w-10 place-items-center rounded-xl">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-text text-lg font-bold">
            {t('title')}
          </h2>
          <p className="text-text-muted text-sm">{t('subtitle')}</p>
        </div>
      </header>
      <ul className="flex flex-wrap gap-2">
        {centroide.map((trait) => (
          <li
            key={trait}
            className="bg-secondary-soft/40 text-secondary-hover rounded-full px-3 py-1.5 text-xs font-semibold"
          >
            {trait}
          </li>
        ))}
      </ul>
    </section>
  )
}
