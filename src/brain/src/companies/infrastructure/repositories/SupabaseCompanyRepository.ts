import { Inject, Injectable } from '@nestjs/common'
import { Company } from '@/companies/domain/entities/Company'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'companies'
const CHUNK_SIZE = 500

interface CompanyRow {
  id: string
  razon_social: string
  ciiu: string
  ciiu_seccion: string
  ciiu_division: string
  ciiu_grupo: string
  municipio: string
  tipo_organizacion: string | null
  personal: number | null
  ingreso_operacion: number | null
  activos_totales: number | null
  email: string | null
  telefono: string | null
  direccion: string | null
  fecha_matricula: string | null
  fecha_renovacion: string | null
  estado: string
  etapa: string
}

@Injectable()
export class SupabaseCompanyRepository implements CompanyRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async findAll(): Promise<Company[]> {
    const { data, error } = await this.db.from(TABLE).select('*')
    if (error) throw error
    return ((data ?? []) as CompanyRow[]).map((r) => this.toEntity(r))
  }

  async findById(id: string): Promise<Company | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data as CompanyRow) : null
  }

  async findByCiiuDivision(division: string): Promise<Company[]> {
    return this.findManyByEq('ciiu_division', division)
  }

  async findByMunicipio(municipio: string): Promise<Company[]> {
    return this.findManyByEq('municipio', municipio)
  }

  async findUpdatedSince(timestamp: Date): Promise<Company[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .gt('updated_at', timestamp.toISOString())
    if (error) throw error
    return ((data ?? []) as CompanyRow[]).map((r) => this.toEntity(r))
  }

  async count(): Promise<number> {
    const { error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  }

  async saveMany(companies: Company[]): Promise<void> {
    if (companies.length === 0) return
    const rows = companies.map((c) => this.toRow(c))
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const { error } = await this.db
        .from(TABLE)
        .upsert(chunk, { onConflict: 'id' })
      if (error) throw error
    }
  }

  private async findManyByEq(
    column: 'ciiu_division' | 'municipio',
    value: string,
  ): Promise<Company[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq(column, value)
    if (error) throw error
    return ((data ?? []) as CompanyRow[]).map((r) => this.toEntity(r))
  }

  private toEntity(row: CompanyRow): Company {
    return Company.create({
      id: row.id,
      razonSocial: row.razon_social,
      ciiu: `${row.ciiu_seccion}${row.ciiu}`,
      municipio: row.municipio,
      tipoOrganizacion: row.tipo_organizacion,
      personal: row.personal != null ? Number(row.personal) : 0,
      ingresoOperacion:
        row.ingreso_operacion != null ? Number(row.ingreso_operacion) : 0,
      activosTotales:
        row.activos_totales != null ? Number(row.activos_totales) : 0,
      email: row.email,
      telefono: row.telefono,
      direccion: row.direccion,
      fechaMatricula: row.fecha_matricula
        ? new Date(row.fecha_matricula)
        : null,
      fechaRenovacion: row.fecha_renovacion
        ? new Date(row.fecha_renovacion)
        : null,
      estado: row.estado,
    })
  }

  private toRow(c: Company): CompanyRow {
    return {
      id: c.id,
      razon_social: c.razonSocial,
      ciiu: c.ciiu,
      ciiu_seccion: c.ciiuSeccion,
      ciiu_division: c.ciiuDivision,
      ciiu_grupo: c.ciiuGrupo,
      municipio: c.municipio,
      tipo_organizacion: c.tipoOrganizacion,
      personal: c.personal,
      ingreso_operacion: c.ingresoOperacion,
      activos_totales: c.activosTotales,
      email: c.email,
      telefono: c.telefono,
      direccion: c.direccion,
      fecha_matricula: c.fechaMatricula ? toIsoDate(c.fechaMatricula) : null,
      fecha_renovacion: c.fechaRenovacion ? toIsoDate(c.fechaRenovacion) : null,
      estado: c.estado,
      etapa: c.etapa,
    }
  }
}

function toIsoDate(date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
