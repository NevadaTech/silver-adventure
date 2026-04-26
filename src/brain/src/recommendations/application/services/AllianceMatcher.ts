import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Company } from '@/companies/domain/entities/Company'
import { DynamicValueChainRules } from '@/recommendations/application/services/DynamicValueChainRules'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import { env } from '@/shared/infrastructure/env'

const SAME_MUNICIPIO_SCORE = 0.75
const DIFF_MUNICIPIO_SCORE = 0.55

@Injectable()
export class AllianceMatcher {
  constructor(private readonly dynamicRules: DynamicValueChainRules) {}

  async match(companies: Company[]): Promise<Map<string, Recommendation[]>> {
    const ecosystems = await this.dynamicRules.getEcosystems(
      env.AI_DRIVEN_RULES_ENABLED === 'true',
    )

    const byCiiu = new Map<string, Company[]>()
    for (const c of companies) {
      const arr = byCiiu.get(c.ciiu) ?? []
      arr.push(c)
      byCiiu.set(c.ciiu, arr)
    }

    const out = new Map<string, Recommendation[]>()
    const seen = new Set<string>()

    for (const eco of ecosystems) {
      const members = eco.ciiuCodes.flatMap((code) => byCiiu.get(code) ?? [])
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i]
          const b = members[j]
          if (a.ciiu === b.ciiu) continue
          if (a.id === b.id) continue
          const dedupeKey = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
          if (seen.has(dedupeKey)) continue
          seen.add(dedupeKey)

          const score =
            a.municipio === b.municipio
              ? SAME_MUNICIPIO_SCORE
              : DIFF_MUNICIPIO_SCORE
          const reasonsA = Reasons.empty().add({
            feature: 'ecosistema_compartido',
            weight: 0.5,
            value: eco.id,
            description: `Ambas en el ecosistema ${eco.name}`,
          })
          const reasonsB = Reasons.empty().add({
            feature: 'ecosistema_compartido',
            weight: 0.5,
            value: eco.id,
            description: `Ambas en el ecosistema ${eco.name}`,
          })

          appendTo(
            out,
            a.id,
            Recommendation.create({
              id: randomUUID(),
              sourceCompanyId: a.id,
              targetCompanyId: b.id,
              relationType: 'aliado',
              score,
              reasons: reasonsA,
              source: 'ecosystem',
            }),
          )
          appendTo(
            out,
            b.id,
            Recommendation.create({
              id: randomUUID(),
              sourceCompanyId: b.id,
              targetCompanyId: a.id,
              relationType: 'aliado',
              score,
              reasons: reasonsB,
              source: 'ecosystem',
            }),
          )
        }
      }
    }
    return out
  }
}

function appendTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key) ?? []
  arr.push(value)
  map.set(key, arr)
}
