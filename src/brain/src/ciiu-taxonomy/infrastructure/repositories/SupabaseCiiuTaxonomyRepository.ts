import { Inject, Injectable } from '@nestjs/common'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { CiiuTaxonomyRepository } from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'ciiu_taxonomy'
const CHUNK_SIZE = 500

interface CiiuTaxonomyRow {
  code: string
  titulo_actividad: string
  seccion: string
  division: string
  grupo: string
  titulo_seccion: string
  titulo_division: string
  titulo_grupo: string
  macro_sector: string | null
}

@Injectable()
export class SupabaseCiiuTaxonomyRepository implements CiiuTaxonomyRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async findByCode(code: string): Promise<CiiuActivity | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('code', code)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data as CiiuTaxonomyRow) : null
  }

  async findByCodes(codes: string[]): Promise<CiiuActivity[]> {
    if (codes.length === 0) return []
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .in('code', codes)
    if (error) throw error
    return ((data ?? []) as CiiuTaxonomyRow[]).map((r) => this.toEntity(r))
  }

  async findBySection(seccion: string): Promise<CiiuActivity[]> {
    return this.findManyByEq('seccion', seccion)
  }

  async findByDivision(division: string): Promise<CiiuActivity[]> {
    return this.findManyByEq('division', division)
  }

  async findByGrupo(grupo: string): Promise<CiiuActivity[]> {
    return this.findManyByEq('grupo', grupo)
  }

  async saveAll(activities: CiiuActivity[]): Promise<void> {
    if (activities.length === 0) return
    const rows: CiiuTaxonomyRow[] = activities.map((a) => ({
      code: a.code,
      titulo_actividad: a.titulo,
      seccion: a.seccion,
      division: a.division,
      grupo: a.grupo,
      titulo_seccion: a.tituloSeccion,
      titulo_division: a.tituloDivision,
      titulo_grupo: a.tituloGrupo,
      macro_sector: a.macroSector,
    }))
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const { error } = await this.db
        .from(TABLE)
        .upsert(chunk, { onConflict: 'code' })
      if (error) throw error
    }
  }

  private async findManyByEq(
    column: 'seccion' | 'division' | 'grupo',
    value: string,
  ): Promise<CiiuActivity[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq(column, value)
    if (error) throw error
    return ((data ?? []) as CiiuTaxonomyRow[]).map((r) => this.toEntity(r))
  }

  private toEntity(row: CiiuTaxonomyRow): CiiuActivity {
    return CiiuActivity.create({
      code: row.code,
      titulo: row.titulo_actividad,
      seccion: row.seccion,
      division: row.division,
      grupo: row.grupo,
      tituloSeccion: row.titulo_seccion,
      tituloDivision: row.titulo_division,
      tituloGrupo: row.titulo_grupo,
      macroSector: row.macro_sector,
    })
  }
}
