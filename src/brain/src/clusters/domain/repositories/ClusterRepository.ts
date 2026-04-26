import type { Cluster } from '@/clusters/domain/entities/Cluster'
import type { ClusterType } from '@/clusters/domain/value-objects/ClusterType'

export const CLUSTER_REPOSITORY = Symbol('CLUSTER_REPOSITORY')

export interface ClusterRepository {
  findAll(): Promise<Cluster[]>
  findById(id: string): Promise<Cluster | null>
  findManyByIds(ids: string[]): Promise<Cluster[]>
  findByTipo(tipo: ClusterType): Promise<Cluster[]>
  /**
   * Finds a heuristic-grupo cluster matching both ciiuGrupo and municipio.
   * Used by the onboard flow to reuse existing heuristic clusters before
   * creating a new one.
   */
  findByGrupoAndMunicipio(
    ciiuGrupo: string,
    municipio: string,
  ): Promise<Cluster | null>
  saveMany(clusters: Cluster[]): Promise<void>
  updateDescripcion(id: string, descripcion: string): Promise<void>
  count(): Promise<number>
  /**
   * Deletes all clusters of the given tipo. Used to clean up
   * heuristic-ecosistema clusters before regenerating them.
   */
  deleteByType(tipo: ClusterType): Promise<void>
}
