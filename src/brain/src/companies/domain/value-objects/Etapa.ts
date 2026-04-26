export const ETAPAS = [
  'nacimiento',
  'crecimiento',
  'consolidacion',
  'madurez',
] as const

export type Etapa = (typeof ETAPAS)[number]

export function isEtapa(value: string): value is Etapa {
  return (ETAPAS as readonly string[]).includes(value)
}
