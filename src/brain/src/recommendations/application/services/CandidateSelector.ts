import { Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import {
  ECOSYSTEMS,
  VALUE_CHAIN_RULES,
} from '@/recommendations/application/services/ValueChainRules'

export function canonicalPair(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`
}

export interface CandidateCacheEntry {
  hasMatch: boolean
}

@Injectable()
export class CandidateSelector {
  selectCiiuPairs(companies: Company[]): Set<string> {
    const distinctCiius = Array.from(new Set(companies.map((c) => c.ciiu)))
    const pairs = new Set<string>()

    for (const a of distinctCiius) {
      pairs.add(canonicalPair(a, a))

      for (const b of distinctCiius) {
        if (a === b) continue

        if (a.slice(0, 2) === b.slice(0, 2)) {
          pairs.add(canonicalPair(a, b))
          continue
        }

        const inRules = VALUE_CHAIN_RULES.some(
          (r) =>
            (r.ciiuOrigen === a &&
              (r.ciiuDestino === b || r.ciiuDestino === '*')) ||
            (r.ciiuOrigen === b &&
              (r.ciiuDestino === a || r.ciiuDestino === '*')),
        )
        if (inRules) {
          pairs.add(canonicalPair(a, b))
          continue
        }

        const inEcosystem = ECOSYSTEMS.some(
          (e) => e.ciiuCodes.includes(a) && e.ciiuCodes.includes(b),
        )
        if (inEcosystem) {
          pairs.add(canonicalPair(a, b))
        }
      }
    }
    return pairs
  }

  selectTargetCompanies(
    source: Company,
    allCompanies: Company[],
    cache: Map<string, CandidateCacheEntry>,
    topN: number = 30,
  ): Company[] {
    return allCompanies
      .filter((t) => t.id !== source.id)
      .filter(
        (t) => cache.get(canonicalPair(source.ciiu, t.ciiu))?.hasMatch === true,
      )
      .map((t) => ({ company: t, score: proximityScore(source, t) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((x) => x.company)
  }
}

function proximityScore(a: Company, b: Company): number {
  let s = 0
  if (a.municipio === b.municipio) s += 0.5
  if (a.etapa === b.etapa) s += 0.3
  if (a.ciiuDivision === b.ciiuDivision) s += 0.2
  return s
}
