import { Entity } from '@/shared/domain/Entity'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'

export const RECOMMENDATION_SOURCES = [
  'rule',
  'cosine',
  'ecosystem',
  'ai-inferred',
] as const

export type RecommendationSource = (typeof RECOMMENDATION_SOURCES)[number]

export function isRecommendationSource(s: string): s is RecommendationSource {
  return (RECOMMENDATION_SOURCES as readonly string[]).includes(s)
}

interface RecommendationProps {
  sourceCompanyId: string
  targetCompanyId: string
  relationType: RelationType
  score: number
  reasons: Reasons
  source: RecommendationSource
  explanation: string | null
  explanationCachedAt: Date | null
}

export interface CreateRecommendationInput {
  id: string
  sourceCompanyId: string
  targetCompanyId: string
  relationType: RelationType
  score: number
  reasons: Reasons
  source: RecommendationSource
  explanation?: string | null
  explanationCachedAt?: Date | null
}

export class Recommendation extends Entity<string> {
  private readonly props: RecommendationProps

  private constructor(id: string, props: RecommendationProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static create(data: CreateRecommendationInput): Recommendation {
    const id = data.id?.trim() ?? ''
    if (id.length === 0) {
      throw new Error('Recommendation.id cannot be empty')
    }
    const sourceCompanyId = data.sourceCompanyId?.trim() ?? ''
    if (sourceCompanyId.length === 0) {
      throw new Error('Recommendation.sourceCompanyId cannot be empty')
    }
    const targetCompanyId = data.targetCompanyId?.trim() ?? ''
    if (targetCompanyId.length === 0) {
      throw new Error('Recommendation.targetCompanyId cannot be empty')
    }
    if (sourceCompanyId === targetCompanyId) {
      throw new Error('Cannot recommend a company to itself')
    }
    if (data.score < 0 || data.score > 1) {
      throw new Error(
        `Recommendation.score must be between 0 and 1, got ${data.score}`,
      )
    }

    return new Recommendation(id, {
      sourceCompanyId,
      targetCompanyId,
      relationType: data.relationType,
      score: data.score,
      reasons: data.reasons,
      source: data.source,
      explanation: data.explanation ?? null,
      explanationCachedAt: data.explanationCachedAt ?? null,
    })
  }

  withExplanation(explanation: string, cachedAt: Date): Recommendation {
    return new Recommendation(this.id, {
      ...this.props,
      explanation,
      explanationCachedAt: cachedAt,
    })
  }

  get sourceCompanyId(): string {
    return this.props.sourceCompanyId
  }
  get targetCompanyId(): string {
    return this.props.targetCompanyId
  }
  get relationType(): RelationType {
    return this.props.relationType
  }
  get score(): number {
    return this.props.score
  }
  get reasons(): Reasons {
    return this.props.reasons
  }
  get source(): RecommendationSource {
    return this.props.source
  }
  get explanation(): string | null {
    return this.props.explanation
  }
  get explanationCachedAt(): Date | null {
    return this.props.explanationCachedAt
  }
}
