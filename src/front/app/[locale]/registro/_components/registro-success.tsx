'use client'

import { CheckCircle2, MessageCircle, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import type { RegistroDataPartial } from './schema'

const WHATSAPP_NUMBER = '573000000000'

type Props = {
  data: RegistroDataPartial
}

export function RegistroSuccess({ data }: Props) {
  const t = useTranslations('Landing.Registro.Success')

  const prefilled = encodeURIComponent(
    t('whatsappPrefilled', {
      nombre: data.nombre ?? '',
    }),
  )
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${prefilled}`

  return (
    <div className="bg-surface border-border-soft animate-fade-up rounded-3xl border p-8 text-center sm:p-12">
      <div className="bg-success/10 text-success mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full">
        <CheckCircle2 className="h-12 w-12" strokeWidth={2.4} />
      </div>

      <h1 className="font-display text-text mb-3 text-3xl font-bold sm:text-4xl">
        {t('title')}
      </h1>
      <p className="text-text-secondary mx-auto mb-10 max-w-md text-base leading-relaxed">
        {t('body')}
      </p>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-accent text-accent-text hover:bg-accent-hover inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl px-8 font-semibold shadow-lg shadow-black/5 transition-transform hover:scale-105 active:scale-95 sm:w-auto"
        >
          <MessageCircle className="h-5 w-5" />
          {t('ctaWhatsapp')}
        </a>
        <Link
          href="/"
          className="text-text-secondary hover:text-text inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('ctaHome')}
        </Link>
      </div>
    </div>
  )
}
