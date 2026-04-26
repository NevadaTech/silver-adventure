import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Company } from '@/companies/domain/entities/Company'
import { canonicalPair } from '@/recommendations/application/services/CandidateSelector'
import {
  FeatureVectorBuilder,
  type CompanyVector,
} from '@/recommendations/application/services/FeatureVectorBuilder'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { AI_MATCH_CACHE_REPOSITORY } from '@/recommendations/domain/repositories/AiMatchCacheRepository'
import type { AiMatchCacheRepository } from '@/recommendations/domain/repositories/AiMatchCacheRepository'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import {
  inverseRelation,
  type RelationType,
} from '@/recommendations/domain/value-objects/RelationType'

const MIN_CONFIDENCE = 0.5
const AI_WEIGHT = 0.6
const PROXIMITY_WEIGHT = 0.4

interface CachedMatch {
  confidence: number
  relationType: RelationType
  reason: string
}

@Injectable()
export class AiCacheExpander {
  constructor(
    @Inject(AI_MATCH_CACHE_REPOSITORY)
    private readonly cache: AiMatchCacheRepository,
    private readonly featureBuilder: FeatureVectorBuilder,
  ) {}

  async expandForCompany(
    source: Company,
    universe: Company[],
  ): Promise<Recommendation[]> {
    const cacheMap = await this.loadCacheMap()
    return this.expandForCompanyWithCache(source, universe, cacheMap)
  }

  async expandForAll(
    companies: Company[],
  ): Promise<Map<string, Recommendation[]>> {
    const cacheMap = await this.loadCacheMap()
    const out = new Map<string, Recommendation[]>()
    for (const source of companies) {
      const recs = this.expandForCompanyWithCache(source, companies, cacheMap)
      if (recs.length > 0) out.set(source.id, recs)
    }
    return out
  }

  private async loadCacheMap(): Promise<Map<string, CachedMatch>> {
    const allEntries = await this.cache.findAll()
    const cacheMap = new Map<string, CachedMatch>()
    for (const e of allEntries) {
      if (!e.hasMatch || !e.relationType) continue
      if ((e.confidence ?? 0) < MIN_CONFIDENCE) continue
      cacheMap.set(canonicalPair(e.ciiuOrigen, e.ciiuDestino), {
        confidence: e.confidence ?? 0,
        relationType: e.relationType,
        reason: e.reason ?? '',
      })
    }
    return cacheMap
  }

  private expandForCompanyWithCache(
    source: Company,
    universe: Company[],
    cacheMap: Map<string, CachedMatch>,
  ): Recommendation[] {
    const sourceVec = this.featureBuilder.build(source)
    const targetVectors = new Map<string, CompanyVector>()
    const out: Recommendation[] = []

    for (const target of universe) {
      if (source.id === target.id) continue

      const entry = cacheMap.get(canonicalPair(source.ciiu, target.ciiu))
      if (!entry) continue

      let targetVec = targetVectors.get(target.id)
      if (!targetVec) {
        targetVec = this.featureBuilder.build(target)
        targetVectors.set(target.id, targetVec)
      }
      const proximity = this.featureBuilder.proximity(sourceVec, targetVec)
      const score = Math.min(
        1,
        entry.confidence * (AI_WEIGHT + PROXIMITY_WEIGHT * proximity),
      )

      const relationType =
        source.ciiu <= target.ciiu
          ? entry.relationType
          : inverseRelation(entry.relationType)

      const baseReasons = Reasons.from([
        {
          feature: 'ai_inferido',
          weight: entry.confidence,
          description: entry.reason,
        },
      ])
      const reasons =
        source.municipio === target.municipio
          ? baseReasons.add({
              feature: 'mismo_municipio',
              weight: 0.2,
              value: source.municipio,
              description: `Ambas en ${source.municipio}`,
            })
          : baseReasons

      out.push(
        Recommendation.create({
          id: randomUUID(),
          sourceCompanyId: source.id,
          targetCompanyId: target.id,
          relationType,
          score,
          reasons,
          source: 'ai-inferred',
        }),
      )
    }
    return out
  }
}
