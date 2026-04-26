import { Inject, Injectable } from '@nestjs/common'
import { CIIU_GRAPH_PORT } from '@/recommendations/domain/ports/CiiuGraphPort'
import type { CiiuGraphPort } from '@/recommendations/domain/ports/CiiuGraphPort'
import {
  ECOSYSTEMS,
  VALUE_CHAIN_RULES,
  type Ecosystem,
  type ValueChainRule,
} from '@/recommendations/application/services/ValueChainRules'

export const MATCHER_CONFIDENCE_THRESHOLD = 0.65

@Injectable()
export class DynamicValueChainRules {
  constructor(@Inject(CIIU_GRAPH_PORT) private readonly graph: CiiuGraphPort) {}

  /**
   * Reglas dinámicas + fallback hardcoded selectivo.
   * @param flagEnabled  AI_DRIVEN_RULES_ENABLED. Si false → solo hardcoded.
   * @param threshold    confidence mínima para reglas dinámicas (0.65 default)
   * @returns ValueChainRule[] — superset usable por los matchers
   */
  async getValueChainRules(
    flagEnabled: boolean,
    threshold = MATCHER_CONFIDENCE_THRESHOLD,
  ): Promise<ValueChainRule[]> {
    if (!flagEnabled) return VALUE_CHAIN_RULES

    const dynamic = await this.graph.getMatchingPairs(threshold, [
      'cliente',
      'proveedor',
    ])
    if (dynamic.length === 0) {
      // grafo vacío → fallback completo
      return VALUE_CHAIN_RULES
    }

    // Reglas dinámicas como ValueChainRule[]: weight=confidence
    const dynamicRules: ValueChainRule[] = dynamic.map((e) => ({
      ciiuOrigen: e.ciiuOrigen,
      ciiuDestino: e.ciiuDestino,
      weight: e.confidence,
      description: `IA-driven (${e.relationType}, conf=${e.confidence.toFixed(2)})`,
    }))

    // Fallback HARDCODED solo para pares NO cubiertos por el grafo
    const dynamicKeys = new Set(
      dynamic.map((e) => `${e.ciiuOrigen}|${e.ciiuDestino}`),
    )
    const fallback = VALUE_CHAIN_RULES.filter(
      (r) => !dynamicKeys.has(`${r.ciiuOrigen}|${r.ciiuDestino}`),
    )

    return [...dynamicRules, ...fallback]
  }

  /**
   * Ecosistemas dinámicos + hardcoded (unión completa).
   * @param flagEnabled  AI_DRIVEN_RULES_ENABLED. Si false → solo hardcoded.
   * @param threshold    confidence mínima (0.65 default)
   * @returns Ecosystem[] — superset usable por AllianceMatcher
   */
  async getEcosystems(
    flagEnabled: boolean,
    threshold = MATCHER_CONFIDENCE_THRESHOLD,
  ): Promise<Ecosystem[]> {
    if (!flagEnabled) return ECOSYSTEMS

    const aliados = await this.graph.getMatchingPairs(threshold, ['aliado'])
    if (aliados.length === 0) return ECOSYSTEMS

    // Construir pseudo-ecosistemas dinámicos: cada arista (a, b) genera un mini-eco {a, b}.
    // AllianceMatcher itera todos y dedupea pares con `seen`.
    const dynamicEcos: Ecosystem[] = aliados.map((e, i) => ({
      id: `ai-${i}`,
      name: `IA — ${e.ciiuOrigen}↔${e.ciiuDestino}`,
      ciiuCodes: [e.ciiuOrigen, e.ciiuDestino],
      description: `Aliados sugeridos por IA (conf=${e.confidence.toFixed(2)})`,
    }))

    // Fallback HARDCODED siempre se concatena (unión completa)
    return [...dynamicEcos, ...ECOSYSTEMS]
  }
}
