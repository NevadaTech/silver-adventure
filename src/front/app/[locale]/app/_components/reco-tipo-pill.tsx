import { useTranslations } from 'next-intl'

import type { TipoRelacion } from '../_data/types'

const dotByTipo: Record<TipoRelacion, string> = {
  proveedor: 'bg-success',
  aliado: 'bg-secondary',
  cliente: 'bg-error',
  referente: 'bg-accent',
}

const textByTipo: Record<TipoRelacion, string> = {
  proveedor: 'text-success',
  aliado: 'text-secondary-hover',
  cliente: 'text-error',
  referente: 'text-accent-text',
}

const labelKey: Record<TipoRelacion, string> = {
  proveedor: 'proveedor',
  aliado: 'aliado',
  cliente: 'cliente',
  referente: 'referente',
}

type Props = {
  tipo: TipoRelacion
}

export function RecoTipoPill({ tipo }: Props) {
  const t = useTranslations('App.Recomendaciones.tipos')

  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-medium ${textByTipo[tipo]}`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${dotByTipo[tipo]}`} />
      {t(labelKey[tipo] === 'cliente' ? 'clienteFull' : labelKey[tipo])}
    </span>
  )
}
