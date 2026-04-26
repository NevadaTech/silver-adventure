import { ArrowRight, Check, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { ClusterMember } from '../_data/types'

const flagStyle: Record<ClusterMember['flag'], string> = {
  self: 'bg-primary text-primary-text',
  connected: 'bg-success/15 text-success',
  not_connected: 'bg-bg-tertiary text-text-muted',
}

const flagIcons: Record<
  ClusterMember['flag'],
  React.ComponentType<{ className?: string }>
> = {
  self: User,
  connected: Check,
  not_connected: ArrowRight,
}

type Props = {
  member: ClusterMember
  index: number
  isClickable: boolean
  onSelect?: () => void
}

export function ClusterMemberCard({
  member,
  index,
  isClickable,
  onSelect,
}: Props) {
  const t = useTranslations('App.MiCluster.flag')
  const Icon = flagIcons[member.flag]
  const actor = member.actor

  return (
    <article
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onSelect : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect?.()
              }
            }
          : undefined
      }
      className={`bg-surface border-border-soft animate-fade-up flex flex-col gap-3 rounded-2xl border p-5 transition-all ${
        isClickable
          ? 'hover:border-secondary/40 cursor-pointer hover:-translate-y-0.5 hover:shadow-md'
          : 'cursor-default'
      }`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl text-base font-bold ${actor.avatarColor}`}
          aria-hidden
        >
          {actor.iniciales}
        </span>
        <span className="text-text-muted text-xs font-semibold">
          {member.score}%
        </span>
      </div>

      <div>
        <h3 className="font-display text-text text-base leading-tight font-bold">
          {actor.nombre}
        </h3>
        <p className="text-text-muted mt-1 text-xs">
          {actor.sector} · {actor.barrio}
        </p>
      </div>

      <span
        className={`inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${flagStyle[member.flag]}`}
      >
        <Icon className="h-3 w-3" />
        {t(member.flag)}
      </span>
    </article>
  )
}
