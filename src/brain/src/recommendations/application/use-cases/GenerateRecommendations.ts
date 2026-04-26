import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { AiCacheExpander } from '@/recommendations/application/services/AiCacheExpander'
import { CandidateSelector } from '@/recommendations/application/services/CandidateSelector'
import { CiiuPairEvaluator } from '@/recommendations/application/services/CiiuPairEvaluator'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'
import { PeerMatcher } from '@/recommendations/application/services/PeerMatcher'
import { RecommendationLimiter } from '@/recommendations/application/services/RecommendationLimiter'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { RECOMMENDATION_REPOSITORY } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RecommendationRepository } from '@/recommendations/domain/repositories/RecommendationRepository'
import {
  RELATION_TYPES,
  type RelationType,
} from '@/recommendations/domain/value-objects/RelationType'
import { env } from '@/shared/infrastructure/env'
import type { UseCase } from '@/shared/domain/UseCase'

export interface GenerateRecommendationsInput {
  enableAi?: boolean
}

export interface GenerateRecommendationsResult {
  totalRecommendations: number
  companiesWithRecs: number
  byRelationType: Record<RelationType, number>
}

const TOP_PER_TYPE = 2

@Injectable()
export class GenerateRecommendations implements UseCase<
  GenerateRecommendationsInput,
  GenerateRecommendationsResult
> {
  private readonly logger = new Logger(GenerateRecommendations.name)

  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    private readonly candidateSelector: CandidateSelector,
    private readonly ciiuPairEvaluator: CiiuPairEvaluator,
    private readonly cacheExpander: AiCacheExpander,
    private readonly limiter: RecommendationLimiter,
    private readonly peer: PeerMatcher,
    private readonly valueChain: ValueChainMatcher,
    private readonly alliance: AllianceMatcher,
  ) {}

  async execute(
    input: GenerateRecommendationsInput = {},
  ): Promise<GenerateRecommendationsResult> {
    const aiEnabled = resolveAiEnabled(input.enableAi)

    const companies = (await this.companyRepo.findAll()).filter(
      (c) => c.isActive,
    )

    let recsBySource: Map<string, Recommendation[]>
    if (aiEnabled) {
      try {
        const pairs = this.candidateSelector.selectCiiuPairs(companies)
        const stats = await this.ciiuPairEvaluator.evaluateAll(pairs, {
          concurrency: 4,
        })
        this.logger.log(
          `AI eval stats: total=${stats.total} cached=${stats.cached} evaluated=${stats.evaluated} errors=${stats.errors}`,
        )
        const aiRecs = await this.cacheExpander.expandForAll(companies)
        const fallbackRecs = await this.runFallback(companies)
        recsBySource = new Map<string, Recommendation[]>()
        mergeInto(recsBySource, aiRecs)
        mergeInto(recsBySource, fallbackRecs)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        this.logger.error(
          `AI orchestration failed: ${message} — falling back to hardcoded matchers`,
        )
        recsBySource = await this.runFallback(companies)
      }
    } else {
      this.logger.log('AI disabled — using hardcoded matchers')
      recsBySource = await this.runFallback(companies)
    }

    const limited = this.limit(recsBySource)

    await this.recRepo.deleteAll()
    await this.recRepo.saveAll(flatten(limited))

    return computeStats(limited)
  }

  private async runFallback(
    companies: Company[],
  ): Promise<Map<string, Recommendation[]>> {
    const out = new Map<string, Recommendation[]>()
    mergeInto(out, this.peer.match(companies, { topN: TOP_PER_TYPE }))
    mergeInto(out, await this.valueChain.match(companies))
    mergeInto(out, await this.alliance.match(companies))
    return out
  }

  private limit(
    recs: Map<string, Recommendation[]>,
  ): Map<string, Recommendation[]> {
    const out = new Map<string, Recommendation[]>()
    for (const [sourceId, list] of recs) {
      const dedup = this.limiter.dedupeByTargetAndType(list)
      const capped = this.limiter.capPerType(dedup, TOP_PER_TYPE)
      out.set(sourceId, capped)
    }
    return out
  }
}

function resolveAiEnabled(override: boolean | undefined): boolean {
  if (override !== undefined) return override
  return env.AI_MATCH_INFERENCE_ENABLED === 'true'
}

function flatten(recs: Map<string, Recommendation[]>): Recommendation[] {
  return Array.from(recs.values()).flat()
}

function mergeInto(
  target: Map<string, Recommendation[]>,
  source: Map<string, Recommendation[]>,
): void {
  for (const [key, list] of source) {
    const existing = target.get(key) ?? []
    target.set(key, existing.concat(list))
  }
}

function computeStats(
  recs: Map<string, Recommendation[]>,
): GenerateRecommendationsResult {
  const byRelationType: Record<RelationType, number> = {
    referente: 0,
    cliente: 0,
    proveedor: 0,
    aliado: 0,
  }
  let total = 0
  let companiesWithRecs = 0
  for (const list of recs.values()) {
    if (list.length > 0) companiesWithRecs++
    for (const rec of list) {
      total++
      byRelationType[rec.relationType]++
    }
  }
  void RELATION_TYPES
  return { totalRecommendations: total, companiesWithRecs, byRelationType }
}
