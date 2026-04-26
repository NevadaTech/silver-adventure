import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

export interface CiiuEdgeProps {
  ciiuOrigen: string
  ciiuDestino: string
  hasMatch: boolean
  relationType: RelationType | null
  confidence: number // [0,1]
  modelVersion: string | null // null = legacy
}

export class CiiuEdge {
  private constructor(private readonly props: Readonly<CiiuEdgeProps>) {
    Object.freeze(this.props)
  }

  static create(data: CiiuEdgeProps): CiiuEdge {
    if (!data.ciiuOrigen?.trim()) throw new Error('CiiuEdge.ciiuOrigen empty')
    if (!data.ciiuDestino?.trim()) throw new Error('CiiuEdge.ciiuDestino empty')
    if (data.confidence < 0 || data.confidence > 1) {
      throw new Error(`CiiuEdge.confidence out of [0,1]: ${data.confidence}`)
    }
    if (data.hasMatch && !data.relationType) {
      throw new Error('CiiuEdge.hasMatch=true requires relationType')
    }
    return new CiiuEdge({ ...data })
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
  get confidence(): number {
    return this.props.confidence
  }
  get modelVersion(): string | null {
    return this.props.modelVersion
  }
}
