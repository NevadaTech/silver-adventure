export type BusinessProgram = {
  nombre: string
  desde: string
  activo: boolean
  descripcion: string
}

export type Business = {
  id: string
  iniciales: string
  avatarColor: string
  nombre: string
  sector: string
  etapa: string
  nit: string
  aniosOperando: number
  municipio: string
  barrio: string
  direccion: string
  whatsapp: string
  email: string
  descripcion: string
  productos: string[]
  programas: BusinessProgram[]
  visibilidad: {
    completitud: number
    aparicionesEnClusters: number
    empresasTeRecomiendan: number
    empresasGuardaronPerfil: number
  }
}

export const mockBusiness: Business = {
  id: 'business-brisas',
  iniciales: 'BM',
  avatarColor: 'bg-primary text-primary-text',
  nombre: 'Hotel Brisas Marinas',
  sector: 'Hotelería boutique',
  etapa: 'Madurez',
  nit: '900.123.456-7',
  aniosOperando: 11,
  municipio: 'Santa Marta',
  barrio: 'El Rodadero',
  direccion: 'Carrera 2 con Calle 9, El Rodadero',
  whatsapp: '300 111 2233',
  email: 'contacto@hotelbrisasmarinas.com',
  descripcion:
    '12 habitaciones boutique frente al mar en El Rodadero. Operamos hace 11 años con ocupación promedio del 76%. Temporada alta de diciembre a febrero y de junio a agosto. Especializados en parejas, viajeros internacionales y bodas pequeñas de destino.',
  productos: [
    'Hospedaje boutique',
    'City tours',
    'Eventos privados',
    'Spa y bienestar',
    'Bodas de destino',
    'Convenciones pequeñas',
  ],
  programas: [
    {
      nombre: 'Ruta C',
      desde: '2022',
      activo: true,
      descripcion:
        'Programa de la Cámara de Comercio que conecta con el ecosistema empresarial.',
    },
    {
      nombre: 'Cámara Joven',
      desde: '2023',
      activo: true,
      descripcion:
        'Acompañamiento para empresarios jóvenes con mentorías y red de contactos.',
    },
    {
      nombre: 'Sello de Sostenibilidad',
      desde: '—',
      activo: false,
      descripcion:
        'Certificación de prácticas sostenibles del sector turístico. Pendiente de aplicar.',
    },
  ],
  visibilidad: {
    completitud: 72,
    aparicionesEnClusters: 1,
    empresasTeRecomiendan: 4,
    empresasGuardaronPerfil: 7,
  },
}
