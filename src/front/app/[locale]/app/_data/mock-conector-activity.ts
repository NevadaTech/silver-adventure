import type { ConectorEvent } from './types'

/**
 * Six recent events from the Conector agent. Mocked as a single day
 * timeline ordered chronologically. Used in /app/inicio activity feed.
 */
export const mockConectorActivity: ConectorEvent[] = [
  {
    id: 'evt-1',
    timestamp: '5:00 AM',
    tipo: 'recalculo_nocturno',
    titulo: 'Recalculé tu clúster',
    detalle:
      'Hoteles boutique en El Rodadero · Etapa madurez. 1 miembro nuevo se sumó.',
  },
  {
    id: 'evt-2',
    timestamp: '6:30 AM',
    tipo: 'recomendacion_nueva',
    titulo: '3 nuevas recomendaciones para ti',
    detalle:
      'Doña Lucía (proveedor 92%), Hotel Casa Bambú (aliado 88%), Caribe Travel Co. (cliente 81%).',
  },
  {
    id: 'evt-3',
    timestamp: '8:15 AM',
    tipo: 'miembro_cluster_nuevo',
    titulo: 'Hostal Sierra Nevada se unió a tu clúster',
    detalle:
      'Centralidad 81%. Comparten temporada alta y enfoque en turismo de naturaleza.',
  },
  {
    id: 'evt-4',
    timestamp: '10:30 AM',
    tipo: 'recomendacion_a_otros',
    titulo: 'Te recomendé como cliente potencial',
    detalle:
      'Caribe Travel Co. y Mar y Sol Eventos te tienen ahora en su top 3 de hoteles a contactar.',
  },
  {
    id: 'evt-5',
    timestamp: '12:00 PM',
    tipo: 'recomendacion_nueva',
    titulo: '2 cadenas de valor detectadas',
    detalle:
      'Tu clúster intercambia activamente con Pesca Taganga y con Operadores Tayrona.',
  },
  {
    id: 'evt-6',
    timestamp: '14:30 PM',
    tipo: 'priorizacion_humana',
    titulo: 'Tu perfil necesita una actualización',
    detalle:
      'Faltan productos detallados. Completarlos sube tu centralidad ~12% y tus matches.',
  },
]
