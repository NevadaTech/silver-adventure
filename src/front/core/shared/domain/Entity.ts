/**
 * Base Entity
 *
 * Toda entidad de dominio tiene una identidad (id) que la hace única.
 * Dos entidades son iguales si tienen el mismo id — no importa el resto de sus propiedades.
 *
 * Esto es DDD básico. Si no entendés esto, pará y leé el libro de Evans.
 */
export abstract class Entity<T> {
  protected readonly _id: T

  constructor(id: T) {
    this._id = id
  }

  get id(): T {
    return this._id
  }

  equals(other: Entity<T>): boolean {
    if (!(other instanceof Entity)) return false
    return this._id === other._id
  }
}
