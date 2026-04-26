import type { LlmPort } from '@/shared/domain/LlmPort'
import { env } from '@/shared/infrastructure/env'

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

export class OpenRouterAdapter implements LlmPort {
  private readonly endpoint: string
  private readonly apiKey: string
  private readonly model: string
  private readonly appUrl: string | undefined
  private readonly appName: string | undefined

  constructor() {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error(
        'OpenRouterAdapter requires OPENROUTER_API_KEY (set LLM_PROVIDER=openrouter and the key in .env)',
      )
    }
    this.endpoint = `${env.OPENROUTER_BASE_URL}/chat/completions`
    this.apiKey = env.OPENROUTER_API_KEY
    this.model = env.OPENROUTER_CHAT_MODEL
    this.appUrl = env.OPENROUTER_APP_URL
    this.appName = env.OPENROUTER_APP_NAME
  }

  async generateText(prompt: string): Promise<string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
    if (this.appUrl) headers['HTTP-Referer'] = this.appUrl
    if (this.appName) headers['X-Title'] = this.appName

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const body = (await res
        .json()
        .catch(() => ({}))) as ChatCompletionResponse
      const message = body.error?.message ?? res.statusText
      throw new Error(`OpenRouter request failed (${res.status}): ${message}`)
    }

    const data = (await res.json()) as ChatCompletionResponse
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OpenRouter response had no content')
    }
    return content
  }

  async inferStructured<T>(
    prompt: string,
    validate: (raw: unknown) => T,
  ): Promise<T> {
    const raw = await this.generateText(prompt)
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error(`OpenRouter returned non-JSON: ${cleaned.slice(0, 200)}`)
    }
    return validate(parsed)
  }
}
