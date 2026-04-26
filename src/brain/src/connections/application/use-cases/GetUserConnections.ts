import { Inject, Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import {
  COMPANY_REPOSITORY,
  type CompanyRepository,
} from '@/companies/domain/repositories/CompanyRepository'
import {
  CONNECTION_REPOSITORY,
  type ConnectionRepository,
} from '@/connections/domain/repositories/ConnectionRepository'
import type { ConnectionAction } from '@/connections/domain/value-objects/ConnectionAction'
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'
import type { UseCase } from '@/shared/domain/UseCase'

export interface GetUserConnectionsInput {
  userId: string
}

export interface ConnectionTargetView {
  id: string
  razonSocial: string
  ciiu: string
  ciiuSeccion: string
  municipio: string
  etapa: string
}

export interface ConnectionView {
  id: string
  recommendationId: string
  action: ConnectionAction
  note: string | null
  createdAt: string
  relationType: RelationType | null
  score: number | null
  targetCompany: ConnectionTargetView | null
}

export interface GetUserConnectionsResult {
  connections: ConnectionView[]
}

@Injectable()
export class GetUserConnections implements UseCase<
  GetUserConnectionsInput,
  GetUserConnectionsResult
> {
  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepo: ConnectionRepository,
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
  ) {}

  async execute(
    input: GetUserConnectionsInput,
  ): Promise<GetUserConnectionsResult> {
    const connections = await this.connectionRepo.findByUser(input.userId)
    if (connections.length === 0) {
      return { connections: [] }
    }

    const recIds = Array.from(
      new Set(connections.map((c) => c.recommendationId)),
    )
    const recs = await Promise.all(
      recIds.map((id) => this.recRepo.findById(id)),
    )
    const recMap = new Map(
      recs.filter((r) => r !== null).map((r) => [r!.id, r!]),
    )

    const targetIds = Array.from(
      new Set(Array.from(recMap.values()).map((r) => r.targetCompanyId)),
    )
    const targets = await Promise.all(
      targetIds.map((id) => this.companyRepo.findById(id)),
    )
    const targetMap = new Map<string, Company>()
    for (const t of targets) {
      if (t) targetMap.set(t.id, t)
    }

    return {
      connections: connections.map((c) => {
        const rec = recMap.get(c.recommendationId) ?? null
        const target = rec ? (targetMap.get(rec.targetCompanyId) ?? null) : null
        return {
          id: c.id,
          recommendationId: c.recommendationId,
          action: c.action,
          note: c.note,
          createdAt: c.createdAt.toISOString(),
          relationType: rec?.relationType ?? null,
          score: rec?.score ?? null,
          targetCompany: target ? toTargetView(target) : null,
        }
      }),
    }
  }
}

function toTargetView(c: Company): ConnectionTargetView {
  return {
    id: c.id,
    razonSocial: c.razonSocial,
    ciiu: c.ciiu,
    ciiuSeccion: c.ciiuSeccion,
    municipio: c.municipio,
    etapa: c.etapa,
  }
}
