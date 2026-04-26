import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Company } from '@/companies/domain/entities/Company'
import { DynamicValueChainRules } from '@/recommendations/application/services/DynamicValueChainRules'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import { env } from '@/shared/infrastructure/env'

const SAME_MUNICIPIO_BOOST = 1
const DIFF_MUNICIPIO_FACTOR = 0.85

@Injectable()
export class ValueChainMatcher {
  constructor(private readonly dynamicRules: DynamicValueChainRules) {}

  async match(companies: Company[]): Promise<Map<string, Recommendation[]>> {
    const rules = await this.dynamicRules.getValueChainRules(
      env.AI_DRIVEN_RULES_ENABLED === 'true',
    )

    const byCiiu = new Map<string, Company[]>()
    for (const c of companies) {
      const arr = byCiiu.get(c.ciiu) ?? []
      arr.push(c)
      byCiiu.set(c.ciiu, arr)
    }

    const out = new Map<string, Recommendation[]>()
    for (const rule of rules) {
      const sources = byCiiu.get(rule.ciiuOrigen) ?? []
      const targets =
        rule.ciiuDestino === '*'
          ? companies.filter((c) => c.ciiu !== rule.ciiuOrigen)
          : (byCiiu.get(rule.ciiuDestino) ?? [])

      for (const s of sources) {
        for (const t of targets) {
          if (s.id === t.id) continue
          const factor =
            s.municipio === t.municipio
              ? SAME_MUNICIPIO_BOOST
              : DIFF_MUNICIPIO_FACTOR
          const score = Math.min(1, rule.weight * factor)

          appendTo(
            out,
            s.id,
            Recommendation.create({
              id: randomUUID(),
              sourceCompanyId: s.id,
              targetCompanyId: t.id,
              relationType: 'cliente',
              score,
              reasons: Reasons.empty().add({
                feature: 'cadena_valor_directa',
                weight: rule.weight,
                description: rule.description,
              }),
              source: 'rule',
            }),
          )
          appendTo(
            out,
            t.id,
            Recommendation.create({
              id: randomUUID(),
              sourceCompanyId: t.id,
              targetCompanyId: s.id,
              relationType: 'proveedor',
              score,
              reasons: Reasons.empty().add({
                feature: 'cadena_valor_inversa',
                weight: rule.weight,
                description: rule.description,
              }),
              source: 'rule',
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
