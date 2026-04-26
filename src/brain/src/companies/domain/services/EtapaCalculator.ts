import type { Etapa } from '@/companies/domain/value-objects/Etapa'

interface EtapaInput {
  fechaMatricula: Date | null
  personal: number
  ingreso: number
}

const MILLIS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

export class EtapaCalculator {
  static calculate(input: EtapaInput, now: Date = new Date()): Etapa {
    const { fechaMatricula, personal, ingreso } = input

    if (personal > 200 || ingreso > 5_000_000_000) return 'madurez'

    const years = fechaMatricula
      ? (now.getTime() - fechaMatricula.getTime()) / MILLIS_PER_YEAR
      : null

    if (years === null) {
      if (personal <= 2 && ingreso < 100_000_000) return 'nacimiento'
      if (personal <= 50) return 'crecimiento'
      return 'consolidacion'
    }

    if (years < 2 && personal <= 2) return 'nacimiento'
    if (years < 7 && personal <= 50) return 'crecimiento'
    return 'consolidacion'
  }
}
