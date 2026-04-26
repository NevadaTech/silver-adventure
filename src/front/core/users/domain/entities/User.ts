import { Entity } from '@/core/shared/domain/Entity'

interface UserProps {
  name: string
  email?: string
  createdAt: Date
}

/**
 * User Entity
 *
 * Entidad de dominio para usuarios. Contiene lógica de negocio,
 * NO es un DTO ni un modelo de Supabase. La DB es un detalle de implementación.
 */
export class User extends Entity<string> {
  private readonly props: UserProps

  private constructor(id: string, props: UserProps) {
    super(id)
    this.props = props
  }

  static create(
    id: string,
    name: string,
    createdAt: Date = new Date(),
    email?: string,
  ): User {
    if (!name || name.trim().length === 0) {
      throw new Error('User name cannot be empty')
    }
    return new User(id, {
      name: name.trim(),
      email: email ? email.trim() : undefined,
      createdAt,
    })
  }

  get name(): string {
    return this.props.name
  }

  get email(): string | undefined {
    return this.props.email
  }

  get createdAt(): Date {
    return this.props.createdAt
  }
}
