import type { Actor, Conexion } from './types'

const hotelCasaBambu: Actor = {
  id: 'a-hc',
  iniciales: 'HC',
  nombre: 'Hotel Casa Bambú',
  sector: 'Hotelería boutique',
  barrio: 'El Rodadero',
  origen: 'formal',
  avatarColor: 'bg-primary-soft text-primary',
  whatsapp: '3151234567',
  direccion: 'Calle 6 con Carrera 3, El Rodadero',
  aniosOperando: 9,
  programas: ['Ruta C', 'Cámara Joven'],
  productos: ['Hospedaje', 'City tours compartidos', 'Eventos pequeños'],
  descripcion:
    '14 habitaciones, ocupación promedio 78%. Comparten temporada alta y estructura similar.',
}

const caribeTravel: Actor = {
  id: 'a-ct',
  iniciales: 'CT',
  nombre: 'Caribe Travel Co.',
  sector: 'Agencia de turismo receptivo',
  barrio: 'Centro',
  origen: 'formal',
  avatarColor: 'bg-accent/30 text-accent-text',
  whatsapp: '3001234567',
  direccion: 'Calle 14 con Carrera 1, Centro Histórico',
  aniosOperando: 12,
  programas: ['Ruta C', 'Cámara Joven'],
  productos: ['Paquetes turísticos', 'Tours Tayrona', 'Recepción cruceros'],
  descripcion:
    'Agencia receptiva enfocada en grupos europeos. Programa estadías de 4 a 7 noches.',
}

const sierraNevada: Actor = {
  id: 'a-hsn',
  iniciales: 'SN',
  nombre: 'Hostal Sierra Nevada',
  sector: 'Hotelería boutique',
  barrio: 'Bavaria',
  origen: 'formal',
  avatarColor: 'bg-success/20 text-success',
  whatsapp: '3174448899',
  direccion: 'Carrera 18 con Calle 9, Bavaria',
  aniosOperando: 6,
  programas: ['Ruta C'],
  productos: ['Hospedaje', 'Tours Sierra Nevada', 'Café local'],
  descripcion:
    'Hostal premium para viajeros de naturaleza. Conexión directa con tours a Sierra Nevada.',
}

const donaLucia: Actor = {
  id: 'a-dl',
  iniciales: 'DL',
  nombre: 'Doña Lucía',
  sector: 'Lavandería a domicilio',
  barrio: 'Bastidas',
  origen: 'informal_descubierto',
  avatarColor: 'bg-secondary-soft text-secondary-hover',
  whatsapp: '3104567890',
  direccion: 'Carrera 5 con Calle 14, Bastidas',
  aniosOperando: 6,
  programas: ['Mujeres Productivas'],
  productos: ['Lavado de sábanas', 'Planchado uniformes', 'Lavado en seco'],
  descripcion:
    'Servicio de lavado y planchado a domicilio para hoteles boutique.',
}

const pescaTaganga: Actor = {
  id: 'a-pt',
  iniciales: 'PT',
  nombre: 'Pesca Taganga · Don Beto',
  sector: 'Pescador artesanal',
  barrio: 'Taganga',
  origen: 'informal_descubierto',
  avatarColor: 'bg-success/20 text-success',
  whatsapp: '3203456789',
  direccion: 'Playa principal, Taganga',
  aniosOperando: 18,
  programas: [],
  productos: ['Pargo rojo', 'Mero', 'Sierra', 'Camarón fresco'],
  descripcion:
    'Pesca de bajura todos los días. Entrega producto fresco antes de las 7 am.',
}

const frutasRio: Actor = {
  id: 'a-fr',
  iniciales: 'FR',
  nombre: 'Frutas del Río',
  sector: 'Mayorista de frutas',
  barrio: 'Mamatoco',
  origen: 'informal_registrado',
  avatarColor: 'bg-success/15 text-success',
  whatsapp: '3198765432',
  direccion: 'Plaza de mercado de Mamatoco',
  aniosOperando: 14,
  programas: [],
  productos: ['Mango', 'Patilla', 'Maracuyá', 'Banano de exportación'],
  descripcion:
    'Distribución mayorista de frutas tropicales. Llega a hoteles antes del desayuno.',
}

const marYSol: Actor = {
  id: 'a-my',
  iniciales: 'MY',
  nombre: 'Mar y Sol Eventos',
  sector: 'Catering y eventos',
  barrio: 'Bavaria',
  origen: 'formal',
  avatarColor: 'bg-accent/40 text-accent-text',
  whatsapp: '3009876543',
  direccion: 'Carrera 17 con Calle 11, Bavaria',
  aniosOperando: 8,
  programas: ['Ruta C'],
  productos: ['Catering bodas', 'Banquetes corporativos'],
  descripcion:
    'Catering especializado en bodas de destino. Coordina paquetes de 2-3 noches.',
}

export const mockConexiones: Conexion[] = [
  {
    id: 'cx-1',
    actor: hotelCasaBambu,
    tipoRelacion: 'aliado',
    estado: 'active',
    ultimaInteraccion: 'Hoy',
    proximaAccion:
      'Confirma con ellos el cruce de huéspedes para el puente festivo.',
    notas: '3 mensajes intercambiados esta semana',
  },
  {
    id: 'cx-2',
    actor: caribeTravel,
    tipoRelacion: 'cliente',
    estado: 'active',
    ultimaInteraccion: 'Hace 3 días',
    proximaAccion:
      'Envía la cotización para el grupo de 10 huéspedes europeos.',
    notas: 'Grupo de 10 confirmado para enero',
  },
  {
    id: 'cx-3',
    actor: sierraNevada,
    tipoRelacion: 'aliado',
    estado: 'active',
    ultimaInteraccion: 'Hace 1 semana',
    proximaAccion: 'Cierren el cross-selling de tours Sierra Nevada.',
    notas: 'Cruce activo de huéspedes',
  },
  {
    id: 'cx-4',
    actor: donaLucia,
    tipoRelacion: 'proveedor',
    estado: 'pending',
    ultimaInteraccion: 'Hace 2 días',
    proximaAccion: 'Envía un mensaje de presentación: aún no responde.',
    notas: 'WhatsApp enviado, sin respuesta todavía',
  },
  {
    id: 'cx-5',
    actor: pescaTaganga,
    tipoRelacion: 'proveedor',
    estado: 'pending',
    ultimaInteraccion: 'Sin contactar',
    proximaAccion: 'Pregúntale por entregas semanales para tu cocina.',
    notas: 'Guardada hace 2 días',
  },
  {
    id: 'cx-6',
    actor: frutasRio,
    tipoRelacion: 'proveedor',
    estado: 'paused',
    ultimaInteraccion: 'Hace 32 días',
    proximaAccion: 'Reactiva la conversación: cambiaron precios este mes.',
    notas: 'Sin interacción reciente',
  },
  {
    id: 'cx-7',
    actor: marYSol,
    tipoRelacion: 'cliente',
    estado: 'archived',
    ultimaInteraccion: 'Hace 2 meses',
    notas: 'Archivada por el usuario',
  },
]
