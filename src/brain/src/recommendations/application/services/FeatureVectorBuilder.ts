import { Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import { ETAPAS, type Etapa } from '@/companies/domain/value-objects/Etapa'

export interface CompanyVector {
  ciiuClase: string
  ciiuDivision: string
  ciiuSeccion: string
  municipio: string
  etapaOrdinal: number
  personalLog: number
  ingresoLog: number
}

const PERSONAL_LOG_MAX = Math.log10(10_000 + 1)
const INGRESO_LOG_MAX = Math.log10(10_000_000_000 + 1)

@Injectable()
export class FeatureVectorBuilder {
  build(c: Company): CompanyVector {
    return {
      ciiuClase: c.ciiu,
      ciiuDivision: c.ciiuDivision,
      ciiuSeccion: c.ciiuSeccion,
      municipio: c.municipio,
      etapaOrdinal: etapaOrdinal(c.etapa),
      personalLog: normalizeLog(c.personal, PERSONAL_LOG_MAX),
      ingresoLog: normalizeLog(c.ingresoOperacion, INGRESO_LOG_MAX),
    }
  }

  proximity(a: CompanyVector, b: CompanyVector): number {
    let s = 0
    if (a.municipio === b.municipio) s += 0.4
    if (a.etapaOrdinal === b.etapaOrdinal) s += 0.3
    s += (1 - Math.abs(a.personalLog - b.personalLog)) * 0.2
    s += (1 - Math.abs(a.ingresoLog - b.ingresoLog)) * 0.1
    return Math.min(s, 1)
  }
}

function etapaOrdinal(e: Etapa): number {
  return ETAPAS.indexOf(e) + 1
}

function normalizeLog(value: number, max: number): number {
  if (value <= 0) return 0
  const log = Math.log10(value + 1)
  return Math.max(0, Math.min(1, log / max))
}
