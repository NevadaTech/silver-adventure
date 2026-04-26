export const RELATION_TYPES = [
  'referente',
  'cliente',
  'proveedor',
  'aliado',
] as const

export type RelationType = (typeof RELATION_TYPES)[number]

export function isRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value)
}

export function inverseRelation(t: RelationType): RelationType {
  switch (t) {
    case 'cliente':
      return 'proveedor'
    case 'proveedor':
      return 'cliente'
    case 'referente':
      return 'referente'
    case 'aliado':
      return 'aliado'
  }
}
