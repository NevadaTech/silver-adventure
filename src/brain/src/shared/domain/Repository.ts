/**
 * Base Repository Port (interface)
 *
 * Los ports viven en DOMAIN. Son contratos.
 * Las implementaciones (adapters) viven en INFRASTRUCTURE.
 *
 * Esta es la inversión de dependencia de la arquitectura hexagonal:
 * el dominio define QUÉ necesita, no CÓMO se implementa.
 */
export interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>
  save(entity: T): Promise<void>
  delete(id: ID): Promise<void>
}
