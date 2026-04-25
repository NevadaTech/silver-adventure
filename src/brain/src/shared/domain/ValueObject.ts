/**
 * Base Value Object
 *
 * Un Value Object NO tiene identidad — se define por sus propiedades.
 * Email("a@b.com") === Email("a@b.com") siempre, sin importar quién lo creó.
 *
 * SON INMUTABLES. Nunca mutés un VO — creá uno nuevo.
 */
export abstract class ValueObject<T extends Record<string, unknown>> {
  protected readonly props: T

  constructor(props: T) {
    this.props = Object.freeze({ ...props })
  }

  equals(other: ValueObject<T>): boolean {
    if (!(other instanceof ValueObject)) return false
    return JSON.stringify(this.props) === JSON.stringify(other.props)
  }
}
