import { Inject, Injectable } from '@nestjs/common'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import type { ClusterRepository } from '@/clusters/domain/repositories/ClusterRepository'
import {
  CLUSTER_TYPES,
  type ClusterType,
} from '@/clusters/domain/value-objects/ClusterType'
import { isEtapa, type Etapa } from '@/companies/domain/value-objects/Etapa'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'clusters'
const CHUNK_SIZE = 500

interface ClusterRow {
  id: string
  codigo: string
  titulo: string
  descripcion: string | null
  tipo: string
  ciiu_division: string | null
  ciiu_grupo: string | null
  municipio: string | null
  etapa: string | null
  macro_sector: string | null
  member_count: number
}

@Injectable()
export class SupabaseClusterRepository implements ClusterRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async findAll(): Promise<Cluster[]> {
    const { data, error } = await this.db.from(TABLE).select('*')
    if (error) throw error
    return ((data ?? []) as ClusterRow[]).map((r) => this.toEntity(r))
  }

  async findById(id: string): Promise<Cluster | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data as ClusterRow) : null
  }

  async findManyByIds(ids: string[]): Promise<Cluster[]> {
    if (ids.length === 0) return []
    const { data, error } = await this.db.from(TABLE).select('*').in('id', ids)
    if (error) throw error
    return ((data ?? []) as ClusterRow[]).map((r) => this.toEntity(r))
  }

  async findByTipo(tipo: ClusterType): Promise<Cluster[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('tipo', tipo)
    if (error) throw error
    return ((data ?? []) as ClusterRow[]).map((r) => this.toEntity(r))
  }

  async findByGrupoAndMunicipio(
    ciiuGrupo: string,
    municipio: string,
  ): Promise<Cluster | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('tipo', 'heuristic-grupo')
      .eq('ciiu_grupo', ciiuGrupo)
      .eq('municipio', municipio)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data as ClusterRow) : null
  }

  async saveMany(clusters: Cluster[]): Promise<void> {
    if (clusters.length === 0) return
    const rows = clusters.map((c) => this.toRow(c))
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const { error } = await this.db
        .from(TABLE)
        .upsert(chunk, { onConflict: 'id' })
      if (error) throw error
    }
  }

  async updateDescripcion(id: string, descripcion: string): Promise<void> {
    const { error } = await this.db
      .from(TABLE)
      .update({ descripcion })
      .eq('id', id)
    if (error) throw error
  }

  async count(): Promise<number> {
    const { error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  }

  private toEntity(row: ClusterRow): Cluster {
    if (!isClusterType(row.tipo)) {
      throw new Error(`Unknown cluster tipo from DB: ${row.tipo}`)
    }
    const etapa: Etapa | null =
      row.etapa && isEtapa(row.etapa) ? row.etapa : null
    return Cluster.create({
      id: row.id,
      codigo: row.codigo,
      titulo: row.titulo,
      descripcion: row.descripcion,
      tipo: row.tipo,
      ciiuDivision: row.ciiu_division,
      ciiuGrupo: row.ciiu_grupo,
      municipio: row.municipio,
      etapa,
      macroSector: row.macro_sector,
      memberCount: row.member_count,
    })
  }

  private toRow(c: Cluster): ClusterRow {
    return {
      id: c.id,
      codigo: c.codigo,
      titulo: c.titulo,
      descripcion: c.descripcion,
      tipo: c.tipo,
      ciiu_division: c.ciiuDivision,
      ciiu_grupo: c.ciiuGrupo,
      municipio: c.municipio,
      etapa: c.etapa,
      macro_sector: c.macroSector,
      member_count: c.memberCount,
    }
  }
}

function isClusterType(s: string): s is ClusterType {
  return (CLUSTER_TYPES as readonly string[]).includes(s)
}
