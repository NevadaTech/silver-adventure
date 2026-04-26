import { Injectable } from '@nestjs/common'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import type { ClusterRepository } from '@/clusters/domain/repositories/ClusterRepository'
import type { ClusterType } from '@/clusters/domain/value-objects/ClusterType'

@Injectable()
export class InMemoryClusterRepository implements ClusterRepository {
  private readonly store = new Map<string, Cluster>()

  async findAll(): Promise<Cluster[]> {
    return Array.from(this.store.values())
  }

  async findById(id: string): Promise<Cluster | null> {
    return this.store.get(id) ?? null
  }

  async findManyByIds(ids: string[]): Promise<Cluster[]> {
    const set = new Set(ids)
    return Array.from(this.store.values()).filter((c) => set.has(c.id))
  }

  async findByTipo(tipo: ClusterType): Promise<Cluster[]> {
    return Array.from(this.store.values()).filter((c) => c.tipo === tipo)
  }

  async saveMany(clusters: Cluster[]): Promise<void> {
    for (const c of clusters) {
      this.store.set(c.id, c)
    }
  }

  async updateDescripcion(id: string, descripcion: string): Promise<void> {
    const existing = this.store.get(id)
    if (!existing) return
    const updated = Cluster.create({
      id: existing.id,
      codigo: existing.codigo,
      titulo: existing.titulo,
      descripcion,
      tipo: existing.tipo,
      ciiuDivision: existing.ciiuDivision,
      ciiuGrupo: existing.ciiuGrupo,
      municipio: existing.municipio,
      macroSector: existing.macroSector,
      memberCount: existing.memberCount,
    })
    this.store.set(id, updated)
  }

  async count(): Promise<number> {
    return this.store.size
  }
}
