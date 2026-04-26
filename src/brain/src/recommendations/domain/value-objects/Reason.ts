export type ReasonFeature =
  | 'mismo_ciiu_clase'
  | 'mismo_ciiu_division'
  | 'mismo_ciiu_seccion'
  | 'mismo_municipio'
  | 'misma_etapa'
  | 'misma_macro_sector'
  | 'cadena_valor_directa'
  | 'cadena_valor_inversa'
  | 'ecosistema_compartido'
  | 'ai_inferido'

export interface Reason {
  feature: ReasonFeature
  weight: number
  value?: string | number
  description: string
}

export class Reasons {
  private constructor(private readonly items: readonly Reason[]) {}

  static empty(): Reasons {
    return new Reasons([])
  }

  static from(items: Reason[]): Reasons {
    return new Reasons([...items])
  }

  add(reason: Reason): Reasons {
    return new Reasons([...this.items, reason])
  }

  totalWeight(): number {
    return this.items.reduce((sum, r) => sum + r.weight, 0)
  }

  toJson(): Reason[] {
    return [...this.items]
  }
}
