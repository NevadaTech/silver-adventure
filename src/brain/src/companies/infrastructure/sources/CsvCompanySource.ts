import { Injectable } from '@nestjs/common'
import { Company } from '@/companies/domain/entities/Company'
import type { CompanySource } from '@/companies/domain/sources/CompanySource'
import { CsvLoader } from '@/shared/infrastructure/csv/CsvLoader'
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'

interface RegistradosRow {
  registradosCIIU1_CODIGOSII?: string
  registradoMATRICULA?: string
  registradoRAZONSOCIAL?: string
  municipioTitulo?: string
  tipoOrganizacionTITULO?: string
  registroEstadoTITULO?: string
  registradoACTIVOSTOTALES?: string
  registradoINGRESOPERACION?: string
  regitradoPERSONAL?: string
  regitradoFECMATRICULA?: string
  regitradoFECHREN?: string
  regitradoEMAIL?: string
  regitradoTELEFONO1?: string
  regitradoDIRECCION?: string
}

const CIIU_PATTERN = /^[A-Z]\d{4}$/
const YYYYMMDD_PATTERN = /^(\d{4})(\d{2})(\d{2})$/

@Injectable()
export class CsvCompanySource implements CompanySource {
  async fetchAll(): Promise<Company[]> {
    const rows = await CsvLoader.load<RegistradosRow>(DataPaths.companiesCsv)
    const companies: Company[] = []
    for (const row of rows) {
      const company = this.toCompany(row)
      if (company) companies.push(company)
    }
    return companies
  }

  async fetchUpdatedSince(since: Date): Promise<Company[]> {
    const all = await this.fetchAll()
    return all.filter((c) => c.fechaRenovacion && c.fechaRenovacion > since)
  }

  private toCompany(row: RegistradosRow): Company | null {
    const ciiu = (row.registradosCIIU1_CODIGOSII ?? '').trim()
    if (!CIIU_PATTERN.test(ciiu)) return null

    const id = (row.registradoMATRICULA ?? '').trim()
    const razonSocial = (row.registradoRAZONSOCIAL ?? '').trim()
    if (!id || !razonSocial) return null

    try {
      return Company.create({
        id,
        razonSocial,
        ciiu,
        municipio: (row.municipioTitulo ?? '').trim(),
        tipoOrganizacion: emptyToNull(row.tipoOrganizacionTITULO),
        personal: parseNumber(row.regitradoPERSONAL),
        ingresoOperacion: parseNumber(row.registradoINGRESOPERACION),
        activosTotales: parseNumber(row.registradoACTIVOSTOTALES),
        email: emptyToNull(row.regitradoEMAIL),
        telefono: emptyToNull(row.regitradoTELEFONO1),
        direccion: emptyToNull(row.regitradoDIRECCION),
        fechaMatricula: parseYyyymmdd(row.regitradoFECMATRICULA),
        fechaRenovacion: parseYyyymmdd(row.regitradoFECHREN),
        estado: (row.registroEstadoTITULO ?? '').trim() || 'ACTIVO',
      })
    } catch {
      return null
    }
  }
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return 0
  const n = Number(raw.trim())
  return Number.isFinite(n) ? n : 0
}

function parseYyyymmdd(raw: string | undefined): Date | null {
  if (!raw) return null
  const match = YYYYMMDD_PATTERN.exec(raw.trim())
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return Number.isNaN(date.getTime()) ? null : date
}

function emptyToNull(raw: string | undefined): string | null {
  const trimmed = (raw ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}
