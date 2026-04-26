import { Inject, Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import {
  CLUSTER_CIIU_MAPPING_REPOSITORY,
  type ClusterCiiuMappingRepository,
} from '@/clusters/domain/repositories/ClusterCiiuMappingRepository'
import {
  CLUSTER_MEMBERSHIP_REPOSITORY,
  type ClusterMembershipRepository,
  type Membership,
} from '@/clusters/domain/repositories/ClusterMembershipRepository'
import {
  CLUSTER_REPOSITORY,
  type ClusterRepository,
} from '@/clusters/domain/repositories/ClusterRepository'
import type { Cluster } from '@/clusters/domain/entities/Cluster'
import { Company } from '@/companies/domain/entities/Company'
import {
  COMPANY_REPOSITORY,
  type CompanyRepository,
} from '@/companies/domain/repositories/CompanyRepository'
import { ClassifyCompanyFromDescription } from '@/companies/application/use-cases/ClassifyCompanyFromDescription'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'
import { PeerMatcher } from '@/recommendations/application/services/PeerMatcher'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'
import type { UseCase } from '@/shared/domain/UseCase'

export type YearsOfOperation = 'menos_1' | '1_3' | '3_5' | '5_10' | 'mas_10'

export interface OnboardCompanyFromSignupInput {
  userId: string
  description: string
  businessName: string
  municipio: string
  yearsOfOperation?: YearsOfOperation | null
  hasChamber?: boolean
  nit?: string | null
}

export interface OnboardCompanyFromSignupResult {
  company: Company
  classification: { ciiuTitulo: string; reasoning: string }
  clusters: Cluster[]
  recommendations: Recommendation[]
}

const TOP_PER_TYPE = 10

@Injectable()
export class OnboardCompanyFromSignup implements UseCase<
  OnboardCompanyFromSignupInput,
  OnboardCompanyFromSignupResult
> {
  private readonly logger = new Logger(OnboardCompanyFromSignup.name)

  constructor(
    private readonly classify: ClassifyCompanyFromDescription,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
    @Inject(CLUSTER_REPOSITORY)
    private readonly clusterRepo: ClusterRepository,
    @Inject(CLUSTER_CIIU_MAPPING_REPOSITORY)
    private readonly ciiuMappingRepo: ClusterCiiuMappingRepository,
    @Inject(CLUSTER_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: ClusterMembershipRepository,
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    private readonly peer: PeerMatcher,
    private readonly valueChain: ValueChainMatcher,
    private readonly alliance: AllianceMatcher,
  ) {}

  async execute(
    input: OnboardCompanyFromSignupInput,
  ): Promise<OnboardCompanyFromSignupResult> {
    const classification = await this.classify.execute({
      description: input.description,
      businessName: input.businessName,
      municipio: input.municipio,
    })

    const companyId = resolveCompanyId(input)
    const fechaMatricula = derivedFechaMatricula(input.yearsOfOperation)
    const company = Company.create({
      id: companyId,
      razonSocial: input.businessName,
      ciiu: `${classification.ciiu.seccion}${classification.ciiu.code}`,
      municipio: input.municipio,
      fechaMatricula,
      estado: 'ACTIVO',
    })
    await this.companyRepo.saveMany([company])

    const clusters = await this.resolveClusters(classification.ciiu.code)
    if (clusters.length > 0) {
      const memberships: Membership[] = clusters.map((c) => ({
        clusterId: c.id,
        companyId: company.id,
      }))
      await this.membershipRepo.saveMany(memberships)
    }

    const recommendations = await this.generateRecommendations(company)
    if (recommendations.length > 0) {
      await this.recRepo.saveAll(recommendations)
    }

    this.logger.log(
      `Onboarded ${company.id} ciiu=${company.ciiu} clusters=${clusters.length} recs=${recommendations.length}`,
    )

    return {
      company,
      classification: {
        ciiuTitulo: classification.ciiu.titulo,
        reasoning: classification.reasoning,
      },
      clusters,
      recommendations,
    }
  }

  private async resolveClusters(ciiuCode: string): Promise<Cluster[]> {
    const ciiuToClusters = await this.ciiuMappingRepo.getCiiuToClusterMap()
    const clusterIds = ciiuToClusters.get(ciiuCode) ?? []
    if (clusterIds.length === 0) return []
    return this.clusterRepo.findManyByIds(clusterIds)
  }

  private async generateRecommendations(
    newCompany: Company,
  ): Promise<Recommendation[]> {
    const universe = await this.companyRepo.findAll()
    const activeUniverse = universe.filter((c) => c.isActive)
    if (activeUniverse.length <= 1) return []

    const peerRecs = this.peer.match(activeUniverse, { topN: 20 })
    const valueChainRecs = this.valueChain.match(activeUniverse)
    const allianceRecs = this.alliance.match(activeUniverse)

    const fromNew = mergeFromSource(newCompany.id, [
      peerRecs,
      valueChainRecs,
      allianceRecs,
    ])
    const deduped = dedupeByTargetAndType(fromNew)
    const capped = capPerType(deduped, TOP_PER_TYPE)
    return capped.map((r) =>
      Recommendation.create({
        id: randomUUID(),
        sourceCompanyId: r.sourceCompanyId,
        targetCompanyId: r.targetCompanyId,
        relationType: r.relationType,
        score: r.score,
        reasons: r.reasons,
        source: r.source,
      }),
    )
  }
}

function resolveCompanyId(input: OnboardCompanyFromSignupInput): string {
  if (input.nit && input.nit.trim().length > 0) {
    const sanitized = input.nit.replace(/[^0-9]/g, '')
    if (sanitized.length > 0) return sanitized
  }
  return `signup-${input.userId}`
}

function derivedFechaMatricula(
  years: YearsOfOperation | null | undefined,
): Date | null {
  if (!years) return null
  const now = new Date()
  const monthsBack: Record<YearsOfOperation, number> = {
    menos_1: 6,
    '1_3': 24,
    '3_5': 48,
    '5_10': 84,
    mas_10: 144,
  }
  const date = new Date(now)
  date.setMonth(date.getMonth() - monthsBack[years])
  return date
}

function mergeFromSource(
  sourceId: string,
  maps: Map<string, Recommendation[]>[],
): Recommendation[] {
  const out: Recommendation[] = []
  for (const map of maps) {
    const recs = map.get(sourceId) ?? []
    out.push(...recs)
  }
  return out
}

function dedupeByTargetAndType(recs: Recommendation[]): Recommendation[] {
  const byKey = new Map<string, Recommendation>()
  for (const rec of recs) {
    const key = `${rec.targetCompanyId}|${rec.relationType}`
    const existing = byKey.get(key)
    if (!existing || rec.score > existing.score) {
      byKey.set(key, rec)
    }
  }
  return Array.from(byKey.values())
}

function capPerType(recs: Recommendation[], perType: number): Recommendation[] {
  const sorted = [...recs].sort((a, b) => b.score - a.score)
  const counts = new Map<RelationType, number>()
  const out: Recommendation[] = []
  for (const rec of sorted) {
    const c = counts.get(rec.relationType) ?? 0
    if (c < perType) {
      out.push(rec)
      counts.set(rec.relationType, c + 1)
    }
  }
  return out
}
