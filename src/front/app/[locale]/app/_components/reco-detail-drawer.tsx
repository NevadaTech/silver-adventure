'use client'

import { useEffect, useRef } from 'react'
import {
  Award,
  BookmarkPlus,
  Calendar,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useRecommendationAction } from '@/core/connections/infrastructure/hooks/useRecommendationAction'
import { useUserConnections } from '@/core/connections/infrastructure/hooks/useUserConnections'

import type {
  Ancla,
  AnclaTipo,
  EstadoReco,
  Recomendacion,
} from '../_data/types'

import { RecoStatusPill } from './reco-status-pill'
import { RecoTipoPill } from './reco-tipo-pill'

const FALLBACK_WHATSAPP = '573000000000'

const anclaIcons: Record<AnclaTipo, typeof Users> = {
  pares_conectados: Users,
  distancia_km: MapPin,
  frecuencia_entrega: Calendar,
  programa_compartido: Award,
  sector_compatible: Sparkles,
  anios_operando: Clock,
}

type Props = {
  reco: Recomendacion | null
  onClose: () => void
  onUpdateEstado: (id: string, estado: EstadoReco) => void
}

export function RecoDetailDrawer({ reco, onClose, onUpdateEstado }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!reco) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    closeButtonRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [reco, onClose])

  if (!reco) return null

  return (
    <DrawerContent
      reco={reco}
      onClose={onClose}
      onUpdateEstado={onUpdateEstado}
      closeButtonRef={closeButtonRef}
    />
  )
}

type ContentProps = Props & {
  reco: Recomendacion
  closeButtonRef: React.RefObject<HTMLButtonElement | null>
}

function DrawerContent({
  reco,
  onClose,
  onUpdateEstado,
  closeButtonRef,
}: ContentProps) {
  const t = useTranslations('App.Recomendaciones.Detail')
  const tParent = useTranslations('App.Recomendaciones')
  const tAnclas = useTranslations('App.Recomendaciones.Detail.anclasLabels')

  const { apply, remove, isPending, error } = useRecommendationAction()
  const { isApplied } = useUserConnections()

  const target = reco.target
  const isDescubierto = target.origen === 'informal_descubierto'
  const isGuardada = reco.estado === 'guardada' || isApplied(reco.id, 'saved')
  const isDescartada =
    reco.estado === 'descartada' || isApplied(reco.id, 'dismissed')

  const whatsappNumber = target.whatsapp
    ? `57${target.whatsapp.replace(/\D/g, '')}`
    : FALLBACK_WHATSAPP
  const prefilled = encodeURIComponent(
    t('whatsappPrefilledTemplate', { nombre: target.nombre }),
  )
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${prefilled}`

  async function toggleSaved() {
    const next: EstadoReco = isGuardada ? 'nueva' : 'guardada'
    onUpdateEstado(reco.id, next)
    try {
      if (isGuardada) {
        await remove(reco.id, 'saved')
      } else {
        await apply(reco.id, 'saved')
      }
    } catch {
      onUpdateEstado(reco.id, isGuardada ? 'guardada' : 'nueva')
    }
  }

  async function toggleDismissed() {
    const next: EstadoReco = isDescartada ? 'nueva' : 'descartada'
    onUpdateEstado(reco.id, next)
    try {
      if (isDescartada) {
        await remove(reco.id, 'dismissed')
      } else {
        await apply(reco.id, 'dismissed')
      }
    } catch {
      onUpdateEstado(reco.id, isDescartada ? 'descartada' : 'nueva')
    }
  }

  function trackSimulatedContact() {
    void apply(reco.id, 'simulated_contact').catch(() => {
      // El contacto vía WhatsApp ya se abrió (target=_blank). Si la
      // persistencia falla, no bloqueamos al usuario — solo lo logueamos.
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50"
    >
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />

      <aside className="bg-bg animate-drawer-in absolute inset-y-0 right-0 flex h-full w-full max-w-[600px] flex-col overflow-hidden shadow-2xl shadow-black/20">
        <header className="bg-surface border-border-soft flex items-start justify-between gap-4 border-b px-6 py-5">
          <div className="flex items-start gap-4">
            <span
              className={`grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl text-lg font-bold ${target.avatarColor}`}
              aria-hidden
            >
              {target.iniciales}
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id="drawer-title"
                className="font-display text-text text-xl leading-tight font-bold"
              >
                {target.nombre}
              </h2>
              <p className="text-text-muted mt-1 text-sm">
                {target.sector} · {target.barrio}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isDescubierto ? (
                  <span className="bg-error/10 text-error inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                    <Sparkles className="h-3 w-3" />
                    {tParent('descubierto')}
                  </span>
                ) : null}
                <RecoStatusPill estado={reco.estado} />
              </div>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="text-text-secondary hover:bg-surface-hover hover:text-text grid h-9 w-9 flex-shrink-0 place-items-center rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <section className="bg-bg-secondary border-border-soft mb-6 flex items-end justify-between gap-4 rounded-2xl border p-5">
            <div>
              <span className="text-text-muted text-xs font-bold tracking-wider uppercase">
                {t('match')}
              </span>
              <p className="text-text mt-1 text-4xl leading-none font-bold">
                {reco.score}
                <span className="text-text-muted ml-1 text-base font-semibold">
                  %
                </span>
              </p>
            </div>
            <RecoTipoPill tipo={reco.tipoRelacion} />
          </section>

          <Section title={t('porQue')}>
            <p className="text-text-secondary text-base leading-relaxed">
              {reco.razon}
            </p>
          </Section>

          {reco.anclas?.length ? (
            <Section title={t('anclas')}>
              <ul className="flex flex-col gap-3">
                {reco.anclas.map((ancla, index) => (
                  <AnclaRow
                    key={`${ancla.tipo}-${index}`}
                    ancla={ancla}
                    label={tAnclas(ancla.tipo)}
                  />
                ))}
              </ul>
            </Section>
          ) : null}

          {target.descripcion ? (
            <Section title={t('sobreNegocio')}>
              <p className="text-text-secondary text-sm leading-relaxed">
                {target.descripcion}
              </p>
              <dl className="border-border-soft mt-4 grid grid-cols-1 gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                {target.aniosOperando ? (
                  <Stat
                    label={t('aniosOperandoLabel')}
                    value={t('aniosOperando', { count: target.aniosOperando })}
                  />
                ) : null}
                {target.programas?.length ? (
                  <Stat
                    label={t('programas')}
                    value={target.programas.join(' · ')}
                  />
                ) : null}
              </dl>
            </Section>
          ) : null}

          {target.productos?.length ? (
            <Section title={t('productos')}>
              <ul className="flex flex-wrap gap-2">
                {target.productos.map((producto) => (
                  <li
                    key={producto}
                    className="bg-bg-tertiary text-text rounded-full px-3 py-1 text-xs font-medium"
                  >
                    {producto}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title={t('comoContactar')}>
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="bg-success/10 text-success grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl">
                  <Phone className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-text-muted text-xs font-semibold tracking-wider uppercase">
                    {t('whatsapp')}
                  </p>
                  <p className="text-text font-medium">
                    +57 {target.whatsapp ?? '—'}
                  </p>
                </div>
              </li>
              {target.direccion ? (
                <li className="flex items-start gap-3">
                  <span className="bg-secondary-soft text-secondary-hover grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-text-muted text-xs font-semibold tracking-wider uppercase">
                      {t('direccion')}
                    </p>
                    <p className="text-text font-medium">{target.direccion}</p>
                  </div>
                </li>
              ) : null}
            </ul>
          </Section>
        </div>

        <footer className="bg-bg-secondary border-border-soft flex flex-col gap-2 border-t px-6 py-4">
          {error ? (
            <p
              role="alert"
              className="bg-error/10 text-error -mb-1 rounded-md px-3 py-1.5 text-xs"
            >
              {t('acciones.errorPersistencia')}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDismissed}
              disabled={isPending}
              aria-pressed={isDescartada}
              className={`inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isDescartada
                  ? 'bg-error/10 border-error text-error'
                  : 'border-border text-text-secondary hover:border-error/50 hover:text-error'
              }`}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isDescartada
                ? t('acciones.descartada')
                : t('acciones.descartar')}
            </button>
            <button
              type="button"
              onClick={toggleSaved}
              disabled={isPending}
              aria-pressed={isGuardada}
              className={`inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isGuardada
                  ? 'bg-secondary-soft/30 border-secondary text-secondary-hover'
                  : 'border-border text-text-secondary hover:border-secondary/50 hover:text-secondary-hover'
              }`}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookmarkPlus className="h-4 w-4" />
              )}
              {isGuardada ? t('acciones.guardada') : t('acciones.guardar')}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackSimulatedContact}
              className="bg-primary text-primary-text hover:bg-primary-hover inline-flex min-h-[48px] flex-[1.4] items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-lg shadow-black/5 transition-all hover:shadow-xl active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              {t('acciones.aceptar')}
            </a>
          </div>
        </footer>
      </aside>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border-soft border-b py-5 last:border-b-0">
      <h3 className="text-text-muted mb-3 text-xs font-bold tracking-wider uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function AnclaRow({ ancla, label }: { ancla: Ancla; label: string }) {
  const Icon = anclaIcons[ancla.tipo]
  return (
    <li className="flex items-start gap-3">
      <span className="bg-secondary-soft text-secondary-hover grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="flex flex-1 items-baseline justify-between gap-2">
        <span className="text-text-secondary text-sm">{label}</span>
        <span className="text-text text-sm font-semibold">
          {typeof ancla.valor === 'number' && ancla.tipo === 'distancia_km'
            ? `${ancla.valor} km`
            : ancla.valor}
        </span>
      </div>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-muted text-xs font-semibold tracking-wider uppercase">
        {label}
      </dt>
      <dd className="text-text mt-1 text-sm font-medium">{value}</dd>
    </div>
  )
}
