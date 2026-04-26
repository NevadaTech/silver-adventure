export interface LlmPort {
  generateText(prompt: string): Promise<string>

  inferStructured<T>(prompt: string, validate: (raw: unknown) => T): Promise<T>
}
