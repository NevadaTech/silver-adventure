import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { Actor } from '../_data/types'

type Props = {
  actor: Actor
}

export function RecoActor({ actor }: Props) {
  const t = useTranslations('App.Recomendaciones')

  const isDescubierto = actor.origen === 'informal_descubierto'

  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-md text-sm font-bold ${actor.avatarColor}`}
        aria-hidden
      >
        {actor.iniciales}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text truncate text-sm font-semibold">
            {actor.nombre}
          </span>
          {isDescubierto ? (
            <span className="bg-error/10 text-error inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles className="h-3 w-3" />
              {t('descubierto')}
            </span>
          ) : null}
        </div>
        <p className="text-text-muted truncate text-xs">
          {actor.sector} · {actor.barrio}
        </p>
      </div>
    </div>
  )
}
