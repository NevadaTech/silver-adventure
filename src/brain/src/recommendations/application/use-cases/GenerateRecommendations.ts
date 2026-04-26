import { Inject, Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Company } from '@/companies/domain/entities/Company'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import {
  CandidateSelector,
  canonicalPair,
} from '@/recommendations/application/services/CandidateSelector'
import { CiiuPairEvaluator } from '@/recommendations/application/services/CiiuPairEvaluator'
import {
  FeatureVectorBuilder,
  type CompanyVector,
} from '@/recommendations/application/services/FeatureVectorBuilder'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'
import { PeerMatcher } from '@/recommendations/application/services/PeerMatcher'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { AI_MATCH_CACHE_REPOSITORY } from '@/recommendations/domain/repositories/AiMatchCacheRepository'
import type { AiMatchCacheRepository } from '@/recommendations/domain/repositories/AiMatchCacheRepository'
import { RECOMMENDATION_REPOSITORY } from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RecommendationRepository } from '@/recommendations/domain/repositories/RecommendationRepository'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import {
  inverseRelation,
  type RelationType,
  RELATION_TYPES,
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

const MIN_CONFIDENCE = 0.5
const TOP_PER_TYPE = 5
const TOP_TOTAL = 20
const AI_WEIGHT = 0.6
const PROXIMITY_WEIGHT = 0.4

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
    @Inject(AI_MATCH_CACHE_REPOSITORY)
    private readonly cache: AiMatchCacheRepository,
    private readonly candidateSelector: CandidateSelector,
    private readonly ciiuPairEvaluator: CiiuPairEvaluator,
    private readonly featureBuilder: FeatureVectorBuilder,
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
        recsBySource = await this.expandFromCache(companies)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        this.logger.error(
          `AI orchestration failed: ${message} — falling back to hardcoded matchers`,
        )
        recsBySource = this.runFallback(companies)
      }
    } else {
      this.logger.log('AI disabled — using hardcoded matchers')
      recsBySource = this.runFallback(companies)
    }

    const limited = this.limit(this.dedupe(recsBySource))

    await this.recRepo.deleteAll()
    await this.recRepo.saveAll(flatten(limited))

    return computeStats(limited)
  }

  private async expandFromCache(
    companies: Company[],
  ): Promise<Map<string, Recommendation[]>> {
    const allEntries = await this.cache.findAll()
    const cacheMap = new Map<
      string,
      { confidence: number; relationType: RelationType; reason: string }
    >()
    for (const e of allEntries) {
      if (!e.hasMatch || !e.relationType) continue
      if ((e.confidence ?? 0) < MIN_CONFIDENCE) continue
      cacheMap.set(canonicalPair(e.ciiuOrigen, e.ciiuDestino), {
        confidence: e.confidence ?? 0,
        relationType: e.relationType,
        reason: e.reason ?? '',
      })
    }

    const vectors = new Map<string, CompanyVector>(
      companies.map((c) => [c.id, this.featureBuilder.build(c)]),
    )

    const out = new Map<string, Recommendation[]>()
    for (const source of companies) {
      const sourceVec = vectors.get(source.id)!
      for (const target of companies) {
        if (source.id === target.id) continue
        const entry = cacheMap.get(canonicalPair(source.ciiu, target.ciiu))
        if (!entry) continue

        const proximity = this.featureBuilder.proximity(
          sourceVec,
          vectors.get(target.id)!,
        )
        const score = Math.min(
          1,
          entry.confidence * (AI_WEIGHT + PROXIMITY_WEIGHT * proximity),
        )

        const relationType =
          source.ciiu <= target.ciiu
            ? entry.relationType
            : inverseRelation(entry.relationType)

        const reasons = Reasons.from([
          {
            feature: 'ai_inferido',
            weight: entry.confidence,
            description: entry.reason,
          },
        ])
        const reasonsWithMunicipio =
          source.municipio === target.municipio
            ? reasons.add({
                feature: 'mismo_municipio',
                weight: 0.2,
                value: source.municipio,
                description: `Ambas en ${source.municipio}`,
              })
            : reasons

        appendTo(
          out,
          source.id,
          Recommendation.create({
            id: randomUUID(),
            sourceCompanyId: source.id,
            targetCompanyId: target.id,
            relationType,
            score,
            reasons: reasonsWithMunicipio,
            source: 'ai-inferred',
          }),
        )
      }
    }
    return out
  }

  private runFallback(companies: Company[]): Map<string, Recommendation[]> {
    const out = new Map<string, Recommendation[]>()
    mergeInto(out, this.peer.match(companies, { topN: TOP_PER_TYPE }))
    mergeInto(out, this.valueChain.match(companies))
    mergeInto(out, this.alliance.match(companies))
    return out
  }

  private dedupe(
    recs: Map<string, Recommendation[]>,
  ): Map<string, Recommendation[]> {
    const out = new Map<string, Recommendation[]>()
    for (const [sourceId, list] of recs) {
      const byKey = new Map<string, Recommendation>()
      for (const rec of list) {
        const key = `${rec.targetCompanyId}|${rec.relationType}`
        const existing = byKey.get(key)
        if (!existing || rec.score > existing.score) {
          byKey.set(key, rec)
        }
      }
      out.set(sourceId, Array.from(byKey.values()))
    }
    return out
  }

  private limit(
    recs: Map<string, Recommendation[]>,
  ): Map<string, Recommendation[]> {
    const out = new Map<string, Recommendation[]>()
    for (const [sourceId, list] of recs) {
      const byType = new Map<RelationType, Recommendation[]>()
      const sorted = [...list].sort((a, b) => b.score - a.score)
      for (const rec of sorted) {
        const arr = byType.get(rec.relationType) ?? []
        if (arr.length < TOP_PER_TYPE) {
          arr.push(rec)
          byType.set(rec.relationType, arr)
        }
      }
      const merged = Array.from(byType.values()).flat()
      const trimmed = merged
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_TOTAL)
      out.set(sourceId, trimmed)
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

function appendTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key) ?? []
  arr.push(value)
  map.set(key, arr)
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
