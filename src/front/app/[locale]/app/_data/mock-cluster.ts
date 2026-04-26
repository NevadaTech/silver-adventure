import type { Actor, Cluster } from './types'
import { mockCurrentUser } from './mock-user'

const selfActor: Actor = {
  id: mockCurrentUser.id,
  iniciales: mockCurrentUser.iniciales,
  nombre: mockCurrentUser.empresa,
  sector: mockCurrentUser.sector,
  barrio: mockCurrentUser.barrio,
  origen: 'formal',
  avatarColor: 'bg-primary text-primary-text',
  descripcion:
    '12 habitaciones boutique frente al mar. Ocupación promedio 76%. Temporada alta diciembre a febrero.',
  whatsapp: '3001112233',
  direccion: 'Carrera 2 con Calle 9, El Rodadero',
  aniosOperando: 11,
  programas: ['Ruta C', 'Cámara Joven'],
  productos: ['Hospedaje', 'City tours', 'Eventos privados'],
}

const hotelCasaBambu: Actor = {
  id: 'a-hc',
  iniciales: 'HC',
  nombre: 'Hotel Casa Bambú',
  sector: 'Hotelería boutique',
  barrio: 'El Rodadero',
  origen: 'formal',
  avatarColor: 'bg-primary-soft text-primary',
  descripcion:
    '14 habitaciones, ocupación promedio 78%. Comparten temporada alta y estructura similar.',
  whatsapp: '3151234567',
  direccion: 'Calle 6 con Carrera 3, El Rodadero',
  aniosOperando: 9,
  programas: ['Ruta C', 'Cámara Joven'],
  productos: ['Hospedaje', 'City tours compartidos', 'Eventos pequeños'],
}

const hotelMarAzul: Actor = {
  id: 'a-ma',
  iniciales: 'MA',
  nombre: 'Hotel Mar Azul Boutique',
  sector: 'Hotelería boutique',
  barrio: 'El Rodadero',
  origen: 'formal',
  avatarColor: 'bg-secondary-soft text-secondary-hover',
  descripcion:
    'Diez habitaciones con vista al mar. Foco en parejas y luna de miel.',
  whatsapp: '3185556677',
  direccion: 'Carrera 2 con Calle 12, El Rodadero',
  aniosOperando: 7,
  programas: ['Ruta C'],
  productos: ['Hospedaje', 'Paquetes luna de miel'],
}

const hostalSierraNevada: Actor = {
  id: 'a-hsn',
  iniciales: 'SN',
  nombre: 'Hostal Sierra Nevada',
  sector: 'Hotelería boutique',
  barrio: 'Bavaria',
  origen: 'formal',
  avatarColor: 'bg-success/20 text-success',
  descripcion:
    'Hostal premium para viajeros de naturaleza. Conexión directa con tours a Sierra Nevada.',
  whatsapp: '3174448899',
  direccion: 'Carrera 18 con Calle 9, Bavaria',
  aniosOperando: 6,
  programas: ['Ruta C'],
  productos: ['Hospedaje', 'Tours Sierra Nevada', 'Café local'],
}

const posadaElFaro: Actor = {
  id: 'a-pf',
  iniciales: 'PE',
  nombre: 'Posada El Faro',
  sector: 'Hotelería boutique',
  barrio: 'Taganga',
  origen: 'formal',
  avatarColor: 'bg-bg-tertiary text-text-muted',
  descripcion:
    '12 habitaciones con vista al mar. Capacidad similar y temporada parecida.',
  whatsapp: '3158901234',
  direccion: 'Calle 18 con Carrera 1, Taganga',
  aniosOperando: 5,
  programas: ['Cámara Joven'],
  productos: ['Hospedaje', 'Buceo', 'Eventos privados'],
}

const casaVerdeCaribe: Actor = {
  id: 'a-cvc',
  iniciales: 'CV',
  nombre: 'Casa Verde del Caribe',
  sector: 'Hotelería boutique',
  barrio: 'El Rodadero',
  origen: 'formal',
  avatarColor: 'bg-accent/30 text-accent-text',
  descripcion:
    'Casa colonial restaurada con 9 habitaciones. Foco en turismo cultural.',
  whatsapp: '3209998877',
  direccion: 'Carrera 5 con Calle 11, El Rodadero',
  aniosOperando: 8,
  programas: ['Ruta C'],
  productos: ['Hospedaje', 'Tours patrimoniales'],
}

const posadaGaira: Actor = {
  id: 'a-pg',
  iniciales: 'PG',
  nombre: 'La Posada de Gaira',
  sector: 'Hotelería boutique',
  barrio: 'Gaira',
  origen: 'formal',
  avatarColor: 'bg-error/15 text-error',
  descripcion:
    'Hospedaje familiar tradicional. Ofrece desayuno típico samario y traslados.',
  whatsapp: '3147776655',
  direccion: 'Carrera 4 con Calle 5, Gaira',
  aniosOperando: 14,
  programas: [],
  productos: ['Hospedaje', 'Desayuno típico'],
}

const hotelAluna: Actor = {
  id: 'a-al',
  iniciales: 'AL',
  nombre: 'Hotel Aluna Beach',
  sector: 'Hotelería boutique',
  barrio: 'El Rodadero',
  origen: 'formal',
  avatarColor: 'bg-secondary/15 text-secondary-hover',
  descripcion:
    'Hotel frente a la playa con 13 habitaciones. Eventos corporativos pequeños.',
  whatsapp: '3133332211',
  direccion: 'Calle 8 con Carrera 1, El Rodadero',
  aniosOperando: 4,
  programas: ['Cámara Joven'],
  productos: ['Hospedaje', 'Eventos corporativos', 'Bar de playa'],
}

export const mockCluster: Cluster = {
  id: 'c-hoteles-rodadero-madurez',
  etiqueta: 'Hoteles boutique en El Rodadero',
  etapa: 'Madurez',
  size: 8,
  conexionesActivas: 3,
  centroide: [
    'Hotelería boutique',
    '8-15 habitaciones',
    'Ocupación promedio >70%',
    'Temporada alta dic-feb',
    'Programa Ruta C',
  ],
  miembros: [
    { actor: selfActor, flag: 'self', score: 92 },
    { actor: hotelCasaBambu, flag: 'connected', score: 88 },
    { actor: hotelMarAzul, flag: 'connected', score: 84 },
    { actor: hostalSierraNevada, flag: 'connected', score: 81 },
    { actor: posadaElFaro, flag: 'not_connected', score: 78 },
    { actor: casaVerdeCaribe, flag: 'not_connected', score: 75 },
    { actor: posadaGaira, flag: 'not_connected', score: 71 },
    { actor: hotelAluna, flag: 'not_connected', score: 68 },
  ],
  cadenasDeValor: [
    {
      tipo: 'proveedor',
      etiqueta: 'Pesca, lavandería y suministros frescos',
      count: 5,
      topIniciales: ['DL', 'PT', 'FR'],
    },
    {
      tipo: 'aliado',
      etiqueta: 'Operadores de naturaleza y city tours',
      count: 4,
      topIniciales: ['CT', 'CL'],
    },
    {
      tipo: 'cliente',
      etiqueta: 'Mayoristas y agencias receptivas',
      count: 3,
      topIniciales: ['CT', 'MY', 'VP'],
    },
  ],
}
