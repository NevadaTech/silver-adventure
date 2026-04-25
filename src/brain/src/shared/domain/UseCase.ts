/**
 * Base Use Case
 *
 * Cada caso de uso hace UNA SOLA COSA. Si tu use case hace dos cosas,
 * tenés dos use cases. Así de simple.
 *
 * Input → UseCase → Output. Orquesta el dominio, no lo implementa.
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>
}
