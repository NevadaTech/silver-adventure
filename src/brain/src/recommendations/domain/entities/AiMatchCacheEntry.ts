import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

interface AiMatchCacheEntryProps {
  ciiuOrigen: string
  ciiuDestino: string
  hasMatch: boolean
  relationType: RelationType | null
  confidence: number | null
  reason: string | null
  cachedAt: Date
  modelVersion: string | null
}

export interface CreateAiMatchCacheEntryInput {
  ciiuOrigen: string
  ciiuDestino: string
  hasMatch: boolean
  relationType?: RelationType | null
  confidence?: number | null
  reason?: string | null
  cachedAt?: Date
  modelVersion?: string | null
}

export class AiMatchCacheEntry {
  private constructor(private readonly props: AiMatchCacheEntryProps) {
    Object.freeze(this.props)
  }

  static create(data: CreateAiMatchCacheEntryInput): AiMatchCacheEntry {
    const ciiuOrigen = data.ciiuOrigen?.trim() ?? ''
    if (ciiuOrigen.length === 0) {
      throw new Error('AiMatchCacheEntry.ciiuOrigen cannot be empty')
    }
    const ciiuDestino = data.ciiuDestino?.trim() ?? ''
    if (ciiuDestino.length === 0) {
      throw new Error('AiMatchCacheEntry.ciiuDestino cannot be empty')
    }
    if (data.hasMatch && !data.relationType) {
      throw new Error(
        'AiMatchCacheEntry with hasMatch=true requires a relationType',
      )
    }
    if (
      data.confidence !== null &&
      data.confidence !== undefined &&
      (data.confidence < 0 || data.confidence > 1)
    ) {
      throw new Error(
        `AiMatchCacheEntry.confidence must be between 0 and 1, got ${data.confidence}`,
      )
    }

    return new AiMatchCacheEntry({
      ciiuOrigen,
      ciiuDestino,
      hasMatch: data.hasMatch,
      relationType: data.relationType ?? null,
      confidence: data.confidence ?? null,
      reason: data.reason ?? null,
      cachedAt: data.cachedAt ?? new Date(),
      modelVersion: data.modelVersion ?? null,
    })
  }

  get ciiuOrigen(): string {
    return this.props.ciiuOrigen
  }
  get ciiuDestino(): string {
    return this.props.ciiuDestino
  }
  get hasMatch(): boolean {
    return this.props.hasMatch
  }
  get relationType(): RelationType | null {
    return this.props.relationType
  }
  get confidence(): number | null {
    return this.props.confidence
  }
  get reason(): string | null {
    return this.props.reason
  }
  get cachedAt(): Date {
    return this.props.cachedAt
  }

  get modelVersion(): string | null {
    return this.props.modelVersion
  }

  get key(): string {
    return `${this.props.ciiuOrigen}->${this.props.ciiuDestino}`
  }
}
