import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LlmPort } from '@/shared/domain/LlmPort'
import { env } from '@/shared/infrastructure/env'

export class GeminiAdapter implements LlmPort {
  private readonly client: GoogleGenerativeAI
  private readonly modelName: string

  constructor() {
    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY)
    this.modelName = env.GEMINI_CHAT_MODEL
  }

  async generateText(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.modelName })
    const result = await model.generateContent(prompt)
    return result.response.text()
  }

  async inferStructured<T>(
    prompt: string,
    validate: (raw: unknown) => T,
  ): Promise<T> {
    const raw = await this.generateText(prompt)
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error(`Gemini returned non-JSON: ${cleaned.slice(0, 200)}`)
    }
    return validate(parsed)
  }
}
