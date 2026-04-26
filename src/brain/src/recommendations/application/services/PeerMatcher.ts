import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Company } from '@/companies/domain/entities/Company'
import {
  FeatureVectorBuilder,
  type CompanyVector,
} from '@/recommendations/application/services/FeatureVectorBuilder'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import {
  Reasons,
  type Reason,
} from '@/recommendations/domain/value-objects/Reason'

export interface PeerMatcherOptions {
  topN?: number
}

@Injectable()
export class PeerMatcher {
  constructor(private readonly vectorBuilder: FeatureVectorBuilder) {}

  match(
    companies: Company[],
    options: PeerMatcherOptions = {},
  ): Map<string, Recommendation[]> {
    const topN = options.topN ?? 10
    const vectors = new Map<string, CompanyVector>()
    for (const c of companies) {
      vectors.set(c.id, this.vectorBuilder.build(c))
    }

    const byDivision = new Map<string, Company[]>()
    for (const c of companies) {
      const arr = byDivision.get(c.ciiuDivision) ?? []
      arr.push(c)
      byDivision.set(c.ciiuDivision, arr)
    }

    const out = new Map<string, Recommendation[]>()
    for (const source of companies) {
      const peers = byDivision.get(source.ciiuDivision) ?? []
      const scored = peers
        .filter((p) => p.id !== source.id)
        .map((target) => {
          const score = this.vectorBuilder.proximity(
            vectors.get(source.id)!,
            vectors.get(target.id)!,
          )
          return { target, score }
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)

      const recs = scored.map(({ target, score }) =>
        Recommendation.create({
          id: randomUUID(),
          sourceCompanyId: source.id,
          targetCompanyId: target.id,
          relationType: 'referente',
          score,
          reasons: buildReasons(source, target),
          source: 'cosine',
        }),
      )
      out.set(source.id, recs)
    }
    return out
  }
}

function buildReasons(source: Company, target: Company): Reasons {
  const items: Reason[] = []
  if (source.ciiu === target.ciiu) {
    items.push({
      feature: 'mismo_ciiu_clase',
      weight: 0.4,
      value: source.ciiu,
      description: `Misma clase CIIU ${source.ciiu}`,
    })
  } else if (source.ciiuDivision === target.ciiuDivision) {
    items.push({
      feature: 'mismo_ciiu_division',
      weight: 0.25,
      value: source.ciiuDivision,
      description: `Misma división CIIU ${source.ciiuDivision}`,
    })
  }
  if (source.municipio === target.municipio) {
    items.push({
      feature: 'mismo_municipio',
      weight: 0.3,
      value: source.municipio,
      description: `Mismo municipio: ${source.municipio}`,
    })
  }
  if (source.etapa === target.etapa) {
    items.push({
      feature: 'misma_etapa',
      weight: 0.2,
      value: source.etapa,
      description: `Misma etapa: ${source.etapa}`,
    })
  }
  return Reasons.from(items)
}
