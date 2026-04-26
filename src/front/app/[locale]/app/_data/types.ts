export type TipoRelacion = 'proveedor' | 'aliado' | 'cliente' | 'referente'

export type EstadoReco = 'nueva' | 'vista' | 'guardada' | 'descartada'

export type OrigenActor =
  | 'formal'
  | 'informal_registrado'
  | 'informal_descubierto'

export type AnclaTipo =
  | 'pares_conectados'
  | 'distancia_km'
  | 'frecuencia_entrega'
  | 'programa_compartido'
  | 'sector_compatible'
  | 'anios_operando'

export type Ancla = {
  tipo: AnclaTipo
  valor: string | number
}

export type Actor = {
  id: string
  iniciales: string
  nombre: string
  sector: string
  barrio: string
  origen: OrigenActor
  /**
   * Token-based class for the avatar background. Picked from a small palette
   * keyed by the actor id so the same actor always gets the same color.
   */
  avatarColor: string
  descripcion?: string
  /** WhatsApp without country code (we add +57 in UI). */
  whatsapp?: string
  direccion?: string
  aniosOperando?: number
  programas?: string[]
  productos?: string[]
}

export type SiguienteAccion = 'aceptar_conexion' | 'simular_contacto'

export type Recomendacion = {
  id: string
  target: Actor
  tipoRelacion: TipoRelacion
  score: number
  razon: string
  estado: EstadoReco
  anclas?: Ancla[]
  siguienteAccion?: SiguienteAccion
}

export type CurrentUser = {
  id: string
  nombre: string
  iniciales: string
  empresa: string
  sector: string
  barrio: string
}

export type ClusterMemberFlag = 'self' | 'connected' | 'not_connected'

export type ClusterMember = {
  actor: Actor
  flag: ClusterMemberFlag
  /** 0-100, how central this member is to the cluster centroid. */
  score: number
}

export type ValueChainTipo = 'proveedor' | 'aliado' | 'cliente'

export type ValueChainAdj = {
  tipo: ValueChainTipo
  etiqueta: string
  count: number
  topIniciales: string[]
}

export type Cluster = {
  id: string
  etiqueta: string
  etapa: string
  size: number
  conexionesActivas: number
  centroide: string[]
  miembros: ClusterMember[]
  cadenasDeValor: ValueChainAdj[]
}

export type ConectorEventTipo =
  | 'recalculo_nocturno'
  | 'recomendacion_nueva'
  | 'miembro_cluster_nuevo'
  | 'recomendacion_a_otros'
  | 'priorizacion_humana'

export type ConectorEvent = {
  id: string
  timestamp: string
  tipo: ConectorEventTipo
  titulo: string
  detalle: string
}

export type EstadoConexion = 'active' | 'pending' | 'paused' | 'archived'

export type Conexion = {
  id: string
  actor: Actor
  tipoRelacion: TipoRelacion
  estado: EstadoConexion
  ultimaInteraccion: string
  proximaAccion?: string
  notas?: string
}
