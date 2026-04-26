import { Entity } from '@/shared/domain/Entity'
import { EtapaCalculator } from '@/companies/domain/services/EtapaCalculator'
import type { Etapa } from '@/companies/domain/value-objects/Etapa'

interface CompanyProps {
  razonSocial: string
  ciiu: string
  ciiuSeccion: string
  ciiuDivision: string
  ciiuGrupo: string
  municipio: string
  tipoOrganizacion: string | null
  personal: number
  ingresoOperacion: number
  activosTotales: number
  email: string | null
  telefono: string | null
  direccion: string | null
  fechaMatricula: Date | null
  fechaRenovacion: Date | null
  estado: string
  etapa: Etapa
}

export interface CreateCompanyInput {
  id: string
  razonSocial: string
  ciiu: string
  municipio: string
  tipoOrganizacion?: string | null
  personal?: number | null
  ingresoOperacion?: number | null
  activosTotales?: number | null
  email?: string | null
  telefono?: string | null
  direccion?: string | null
  fechaMatricula?: Date | null
  fechaRenovacion?: Date | null
  estado?: string
}

export class Company extends Entity<string> {
  private readonly props: CompanyProps

  private constructor(id: string, props: CompanyProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static create(data: CreateCompanyInput): Company {
    if (!data.id || data.id.trim().length === 0) {
      throw new Error('Company.id cannot be empty')
    }
    if (!data.razonSocial || data.razonSocial.trim().length === 0) {
      throw new Error('Company.razonSocial cannot be empty')
    }

    const { code, seccion } = parseCiiu(data.ciiu)
    const division = code.slice(0, 2)
    const grupo = code.slice(0, 3)

    const personal = data.personal ?? 0
    const ingreso = data.ingresoOperacion ?? 0
    const fechaMatricula = data.fechaMatricula ?? null

    const etapa = EtapaCalculator.calculate({
      fechaMatricula,
      personal,
      ingreso,
    })

    return new Company(data.id.trim(), {
      razonSocial: data.razonSocial.trim(),
      ciiu: code,
      ciiuSeccion: seccion,
      ciiuDivision: division,
      ciiuGrupo: grupo,
      municipio: data.municipio,
      tipoOrganizacion: data.tipoOrganizacion ?? null,
      personal,
      ingresoOperacion: ingreso,
      activosTotales: data.activosTotales ?? 0,
      email: data.email ?? null,
      telefono: data.telefono ?? null,
      direccion: data.direccion ?? null,
      fechaMatricula,
      fechaRenovacion: data.fechaRenovacion ?? null,
      estado: data.estado ?? 'ACTIVO',
      etapa,
    })
  }

  get razonSocial(): string {
    return this.props.razonSocial
  }
  get ciiu(): string {
    return this.props.ciiu
  }
  get ciiuSeccion(): string {
    return this.props.ciiuSeccion
  }
  get ciiuDivision(): string {
    return this.props.ciiuDivision
  }
  get ciiuGrupo(): string {
    return this.props.ciiuGrupo
  }
  get municipio(): string {
    return this.props.municipio
  }
  get tipoOrganizacion(): string | null {
    return this.props.tipoOrganizacion
  }
  get personal(): number {
    return this.props.personal
  }
  get ingresoOperacion(): number {
    return this.props.ingresoOperacion
  }
  get activosTotales(): number {
    return this.props.activosTotales
  }
  get email(): string | null {
    return this.props.email
  }
  get telefono(): string | null {
    return this.props.telefono
  }
  get direccion(): string | null {
    return this.props.direccion
  }
  get fechaMatricula(): Date | null {
    return this.props.fechaMatricula
  }
  get fechaRenovacion(): Date | null {
    return this.props.fechaRenovacion
  }
  get estado(): string {
    return this.props.estado
  }
  get etapa(): Etapa {
    return this.props.etapa
  }
  get isActive(): boolean {
    return ACTIVE_ESTADOS.has(normalizeEstado(this.props.estado))
  }
}

const ACTIVE_ESTADOS: ReadonlySet<string> = new Set([
  'ACTIVO',
  'MATRICULA ACTIVA',
])

function normalizeEstado(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function parseCiiu(raw: string): { code: string; seccion: string } {
  const trimmed = raw.trim().toUpperCase()
  const withSeccion = /^([A-Z])(\d{4})$/.exec(trimmed)
  if (withSeccion) return { code: withSeccion[2], seccion: withSeccion[1] }
  if (/^\d{4}$/.test(trimmed)) {
    throw new Error(
      `CIIU '${trimmed}' missing section letter. Use the seed/loader to enrich from ciiu_taxonomy first.`,
    )
  }
  throw new Error(`Invalid CIIU format: ${trimmed}`)
}
