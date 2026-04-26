export interface ValueChainRule {
  ciiuOrigen: string
  ciiuDestino: string
  weight: number
  description: string
}

export interface Ecosystem {
  id: string
  name: string
  ciiuCodes: string[]
  description: string
}

export const VALUE_CHAIN_RULES: ValueChainRule[] = [
  {
    ciiuOrigen: '0122',
    ciiuDestino: '4631',
    weight: 0.85,
    description: 'Banano hacia mayoristas de alimentos',
  },
  {
    ciiuOrigen: '0126',
    ciiuDestino: '4631',
    weight: 0.85,
    description: 'Palma de aceite hacia mayoristas',
  },
  {
    ciiuOrigen: '0121',
    ciiuDestino: '4720',
    weight: 0.8,
    description: 'Frutas tropicales hacia minoristas alimentos',
  },
  {
    ciiuOrigen: '4631',
    ciiuDestino: '5611',
    weight: 0.85,
    description: 'Mayorista de alimentos abastece restaurantes',
  },
  {
    ciiuOrigen: '4631',
    ciiuDestino: '5630',
    weight: 0.75,
    description: 'Mayorista abastece bares',
  },
  {
    ciiuOrigen: '4719',
    ciiuDestino: '5611',
    weight: 0.7,
    description: 'Mayorista general hacia restaurantes',
  },
  {
    ciiuOrigen: '4923',
    ciiuDestino: '4290',
    weight: 0.85,
    description: 'Transporte de carga para construcción',
  },
  {
    ciiuOrigen: '4923',
    ciiuDestino: '4631',
    weight: 0.8,
    description: 'Transporte de carga para mayoristas',
  },
  {
    ciiuOrigen: '4923',
    ciiuDestino: '0122',
    weight: 0.75,
    description: 'Transporte de carga para agro',
  },
  {
    ciiuOrigen: '6810',
    ciiuDestino: '4921',
    weight: 0.85,
    description: 'Alquiler de vehículos para flotas de transporte',
  },
  {
    ciiuOrigen: '6810',
    ciiuDestino: '4923',
    weight: 0.85,
    description: 'Alquiler de vehículos para flotas de carga',
  },
  {
    ciiuOrigen: '4111',
    ciiuDestino: '4290',
    weight: 0.85,
    description: 'Movimiento de tierra para construcción general',
  },
  {
    ciiuOrigen: '4752',
    ciiuDestino: '4290',
    weight: 0.85,
    description: 'Ferretería abastece obras',
  },
  {
    ciiuOrigen: '7112',
    ciiuDestino: '4290',
    weight: 0.85,
    description: 'Ingeniería para construcción',
  },
  {
    ciiuOrigen: '6910',
    ciiuDestino: '4290',
    weight: 0.65,
    description: 'Servicios legales para constructoras',
  },
  {
    ciiuOrigen: '7912',
    ciiuDestino: '5511',
    weight: 0.85,
    description: 'Seguridad para hoteles',
  },
  {
    ciiuOrigen: '7912',
    ciiuDestino: '4290',
    weight: 0.75,
    description: 'Seguridad para obras',
  },
  {
    ciiuOrigen: '7020',
    ciiuDestino: '5511',
    weight: 0.6,
    description: 'Eventos corporativos en hoteles',
  },
  {
    ciiuOrigen: '4921',
    ciiuDestino: '5511',
    weight: 0.85,
    description: 'Transporte turístico hacia hoteles',
  },
  {
    ciiuOrigen: '4921',
    ciiuDestino: '5519',
    weight: 0.85,
    description: 'Transporte turístico hacia hostales',
  },
  {
    ciiuOrigen: '7310',
    ciiuDestino: '5611',
    weight: 0.65,
    description: 'Publicidad para restaurantes',
  },
  {
    ciiuOrigen: '7310',
    ciiuDestino: '5511',
    weight: 0.65,
    description: 'Publicidad para hoteles',
  },
  {
    ciiuOrigen: '6910',
    ciiuDestino: '*',
    weight: 0.4,
    description: 'Servicios legales B2B universal',
  },
  {
    ciiuOrigen: '7020',
    ciiuDestino: '*',
    weight: 0.4,
    description: 'Servicios contables/asesoría B2B universal',
  },
]

export const ECOSYSTEMS: Ecosystem[] = [
  {
    id: 'turismo',
    name: 'Turismo',
    ciiuCodes: ['5511', '5519', '5611', '5630', '4921', '6810'],
    description: 'Empresas que sirven al turista que visita Santa Marta',
  },
  {
    id: 'construccion',
    name: 'Construcción',
    ciiuCodes: ['4290', '4111', '7112', '4752', '6910', '4923'],
    description: 'Cadena del proyecto inmobiliario y obra civil',
  },
  {
    id: 'servicios-profesionales',
    name: 'Servicios Profesionales B2B',
    ciiuCodes: ['6910', '7020', '7490', '7310'],
    description: 'Servicios complementarios para empresas',
  },
  {
    id: 'agro-exportador',
    name: 'Agro Exportador',
    ciiuCodes: ['0122', '0126', '0121', '4631', '4923'],
    description: 'Cadena agro-exportador del Magdalena',
  },
  {
    id: 'salud',
    name: 'Salud',
    ciiuCodes: ['8610', '8621', '8692', '7912'],
    description: 'Ecosistema de servicios de salud',
  },
  {
    id: 'educacion',
    name: 'Educación',
    ciiuCodes: ['8512', '8551', '8559'],
    description: 'Ecosistema educativo formal y no formal',
  },
]

export function findRulesForPair(
  ciiuOrigen: string,
  ciiuDestino: string,
  rules: ValueChainRule[] = VALUE_CHAIN_RULES,
): ValueChainRule[] {
  return rules.filter(
    (r) =>
      r.ciiuOrigen === ciiuOrigen &&
      (r.ciiuDestino === '*' || r.ciiuDestino === ciiuDestino),
  )
}

export function findEcosystemsContaining(
  ciiu: string,
  ecosystems: Ecosystem[] = ECOSYSTEMS,
): Ecosystem[] {
  return ecosystems.filter((e) => e.ciiuCodes.includes(ciiu))
}
