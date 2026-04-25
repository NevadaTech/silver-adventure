export interface GeminiPort {
  generateText(prompt: string): Promise<string>

  inferStructured<T>(prompt: string, validate: (raw: unknown) => T): Promise<T>
}
