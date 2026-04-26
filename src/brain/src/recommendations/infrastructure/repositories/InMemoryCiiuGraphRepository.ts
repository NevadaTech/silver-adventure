import type { CiiuGraphPort } from '@/recommendations/domain/ports/CiiuGraphPort'
import type { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

export class InMemoryCiiuGraphRepository implements CiiuGraphPort {
  constructor(private edges: CiiuEdge[] = []) {}

  seed(edges: CiiuEdge[]): void {
    this.edges = edges
  }

  async getMatchingPairs(
    threshold: number,
    relationTypes?: RelationType[],
  ): Promise<CiiuEdge[]> {
    return this.edges.filter(
      (e) =>
        e.hasMatch &&
        e.confidence >= threshold &&
        e.ciiuDestino !== '*' &&
        (!relationTypes ||
          relationTypes.length === 0 ||
          (e.relationType !== null && relationTypes.includes(e.relationType))),
    )
  }

  async getEdgesByOrigin(
    ciiuOrigen: string,
    threshold: number,
  ): Promise<CiiuEdge[]> {
    return this.edges.filter(
      (e) =>
        e.ciiuOrigen === ciiuOrigen &&
        e.hasMatch &&
        e.confidence >= threshold &&
        e.ciiuDestino !== '*',
    )
  }
}
