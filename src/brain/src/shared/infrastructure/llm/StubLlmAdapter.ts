import type { LlmPort } from '@/shared/domain/LlmPort'

export class StubLlmAdapter implements LlmPort {
  constructor(
    private readonly textResponse: string = 'stub response',
    private readonly structuredResponse: unknown = {},
  ) {}

  async generateText(_prompt: string): Promise<string> {
    return this.textResponse
  }

  async inferStructured<T>(
    _prompt: string,
    validate: (raw: unknown) => T,
  ): Promise<T> {
    return validate(this.structuredResponse)
  }
}
