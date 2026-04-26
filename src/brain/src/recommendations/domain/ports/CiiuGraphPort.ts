import type { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

export const CIIU_GRAPH_PORT = Symbol('CIIU_GRAPH_PORT')

export interface CiiuGraphPort {
  /**
   * Devuelve aristas con `hasMatch=true AND confidence >= threshold`,
   * opcionalmente filtradas por `relationType`. Excluye SIEMPRE wildcards
   * (`ciiuDestino === '*'`). El filtrado ocurre en SQL para no traer 25k filas.
   */
  getMatchingPairs(
    threshold: number,
    relationTypes?: RelationType[],
  ): Promise<CiiuEdge[]>

  /**
   * Devuelve aristas salientes desde `ciiuOrigen` con
   * `hasMatch=true AND confidence >= threshold`. Sin wildcards.
   */
  getEdgesByOrigin(ciiuOrigen: string, threshold: number): Promise<CiiuEdge[]>
}
