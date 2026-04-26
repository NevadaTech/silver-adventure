import type { Cluster } from '@/clusters/domain/entities/Cluster'
import type { ClusterType } from '@/clusters/domain/value-objects/ClusterType'

export const CLUSTER_REPOSITORY = Symbol('CLUSTER_REPOSITORY')

export interface ClusterRepository {
  findAll(): Promise<Cluster[]>
  findById(id: string): Promise<Cluster | null>
  findManyByIds(ids: string[]): Promise<Cluster[]>
  findByTipo(tipo: ClusterType): Promise<Cluster[]>
  saveMany(clusters: Cluster[]): Promise<void>
  updateDescripcion(id: string, descripcion: string): Promise<void>
  count(): Promise<number>
}
