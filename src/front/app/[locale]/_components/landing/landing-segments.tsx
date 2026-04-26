import { Store, Truck, ShoppingBag, Handshake } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Reveal } from './reveal'

const audiences = [
  {
    id: 'vendors',
    icon: Store,
    accent: 'bg-primary-soft text-primary',
  },
  {
    id: 'suppliers',
    icon: Truck,
    accent: 'bg-secondary-soft text-secondary-hover',
  },
  {
    id: 'clients',
    icon: ShoppingBag,
    accent: 'bg-accent/30 text-accent-text',
  },
  {
    id: 'allies',
    icon: Handshake,
    accent: 'bg-bg-tertiary text-text',
  },
] as const

export function LandingSegments() {
  const t = useTranslations('Landing.Segments')

  return (
    <section id="audiencias" className="bg-bg-secondary px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-14 text-center">
          <h2 className="font-display text-text mb-3 text-3xl font-bold sm:text-4xl">
            {t('title')}
          </h2>
          <p className="text-text-secondary mx-auto max-w-2xl">
            {t('subtitle')}
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {audiences.map((audience, index) => {
            const Icon = audience.icon
            return (
              <Reveal
                key={audience.id}
                as="article"
                delay={index * 80}
                className="bg-surface border-border-soft hover:border-secondary/40 group flex flex-col gap-4 rounded-2xl border p-6 transition-colors"
              >
                <div
                  className={`grid h-14 w-14 place-items-center rounded-xl ${audience.accent}`}
                >
                  <Icon className="h-7 w-7" strokeWidth={2} />
                </div>
                <h3 className="font-display text-text text-xl font-bold">
                  {t(`${audience.id}.title`)}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {t(`${audience.id}.description`)}
                </p>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
