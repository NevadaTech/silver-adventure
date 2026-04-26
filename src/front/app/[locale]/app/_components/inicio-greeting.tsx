import { useTranslations } from 'next-intl'

type Props = {
  nombre: string
  oportunidades: number
}

export function InicioGreeting({ nombre, oportunidades }: Props) {
  const t = useTranslations('App.Inicio')

  return (
    <header className="flex flex-col gap-2">
      <span className="text-secondary text-xs font-bold tracking-wider uppercase">
        {t('greetingTemplate', { nombre })}
      </span>
      <h1 className="font-display text-text text-2xl font-extrabold tracking-tight sm:text-3xl">
        {t('headline', { count: oportunidades })}
      </h1>
    </header>
  )
}
