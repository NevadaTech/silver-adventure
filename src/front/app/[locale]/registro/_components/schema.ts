import { z } from 'zod'

export const sectores = [
  'comercio',
  'gastronomia',
  'servicios',
  'turismo',
  'pesca',
  'agricultura',
  'artesania',
  'transporte',
  'otros',
] as const

export type Sector = (typeof sectores)[number]

export const tiemposOperando = [
  'menos_1',
  '1_3',
  '3_5',
  '5_10',
  'mas_10',
] as const
export type TiempoOperando = (typeof tiemposOperando)[number]

export const municipiosMagdalena = [
  'Santa Marta',
  'Cienaga',
  'Aracataca',
  'Fundacion',
  'El Banco',
  'Plato',
  'Pivijay',
  'Sitionuevo',
  'Pueblo Viejo',
  'Zona Bananera',
  'Algarrobo',
  'Ariguani',
  'Cerro de San Antonio',
  'Chibolo',
  'Concordia',
  'El Pinon',
  'El Reten',
  'Guamal',
  'Nueva Granada',
  'Pedraza',
  'Pijino del Carmen',
  'Remolino',
  'Sabanas de San Angel',
  'Salamina',
  'San Sebastian de Buenavista',
  'San Zenon',
  'Santa Ana',
  'Santa Barbara de Pinto',
  'Tenerife',
  'Zapayan',
] as const
export type Municipio = (typeof municipiosMagdalena)[number]

/**
 * 70 most-known neighborhoods of Santa Marta. Includes the 9 urban
 * comunas plus 4 corregimientos (Taganga, Bonda, Minca, Guachaca).
 * Sorted alphabetically. 'Otro' as escape value at the end.
 */
export const barriosSantaMarta = [
  '1 de Mayo',
  '11 de Noviembre',
  '17 de Diciembre',
  '20 de Julio',
  '20 de Octubre',
  'Alfonso Lopez',
  'Bastidas',
  'Bavaria',
  'Bello Horizonte',
  'Bolivar',
  'Bolivariana',
  'Bonda',
  'Boston',
  'Bureche',
  'Centro',
  'Centro Historico',
  'Concepcion',
  'Don Jaca',
  'El Bosque',
  'El Carmen',
  'El Chico',
  'El Jardin',
  'El Pando',
  'El Parque',
  'El Reposo',
  'El Rosario',
  'Gaira',
  'Gairamar',
  'Galicia',
  'Garagoa',
  'Goenaga',
  'Guachaca',
  'Juan XXIII',
  'La Esperanza',
  'La Estrella',
  'La Magdalena',
  'Las Acacias',
  'Las Americas',
  'Las Delicias',
  'Las Malvinas',
  'Loma Fresca',
  'Los Alcazares',
  'Los Naranjos',
  'Mamatoco',
  'Manga',
  'Manguitos',
  'Manzanares',
  'Maria Eugenia',
  'Martinete',
  'Minca',
  'Miramar',
  'Modelo',
  'Nueva Colombia',
  'Nueva Galicia',
  'Ondas del Caribe',
  'Paraiso',
  'Pastrana',
  'Pescaito',
  'Polideportivo',
  'Pozos Colorados',
  'Rodadero',
  'Salamanca',
  'San Martin',
  'Santa Lucia',
  'Santafe',
  'Taganga',
  'Tairona',
  'Tamaca',
  'Villa Berlin',
  'Villa Toledo',
  'Villa Universitaria',
  'Otro',
] as const
export type BarrioSantaMarta = (typeof barriosSantaMarta)[number]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Per-step slices of the schema. Used to validate progressively without
 * touching fields the user hasn't reached yet.
 */
export const businessStepSchema = z
  .object({
    nombre: z.string().min(2, 'minLength'),
    registradoCamara: z.boolean(),
    nit: z.string().optional(),
    sector: z.enum(sectores),
    tiempoOperando: z.enum(tiemposOperando),
    descripcion: z.string().min(10, 'minLength').max(280, 'maxLength'),
  })
  .superRefine((data, ctx) => {
    if (!data.registradoCamara) return
    const value = (data.nit ?? '').trim()
    if (!/^[\d.\-]{9,15}$/.test(value)) {
      ctx.addIssue({
        path: ['nit'],
        code: 'custom',
        message: 'invalidNit',
      })
    }
  })

export const contactStepSchema = z
  .object({
    municipio: z.enum(municipiosMagdalena),
    barrio: z.string().min(2, 'minLength'),
    whatsapp: z.string().regex(/^[\d\s\-+()]{7,15}$/, 'invalidWhatsapp'),
    email: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.municipio === 'Santa Marta') {
      if (!barriosSantaMarta.includes(data.barrio as BarrioSantaMarta)) {
        ctx.addIssue({
          path: ['barrio'],
          code: 'custom',
          message: 'minLength',
        })
      }
    }
    const email = (data.email ?? '').trim()
    if (email && !EMAIL_REGEX.test(email)) {
      ctx.addIssue({
        path: ['email'],
        code: 'custom',
        message: 'invalidEmail',
      })
    }
  })

export const confirmStepSchema = z.object({
  acceptTerms: z.literal(true, {
    error: () => 'mustAccept',
  }),
})

export type RegistroData = {
  nombre: string
  registradoCamara: boolean
  nit?: string
  sector: Sector
  tiempoOperando: TiempoOperando
  descripcion: string
  municipio: Municipio
  barrio: string
  whatsapp: string
  email?: string
  acceptTerms: true
}

export type RegistroDataPartial = Partial<RegistroData>

/**
 * Empty state used to seed the wizard.
 */
export const emptyRegistroData: RegistroDataPartial = {
  nombre: '',
  registradoCamara: false,
  nit: '',
  descripcion: '',
  municipio: 'Santa Marta',
  barrio: '',
  whatsapp: '',
  email: '',
  acceptTerms: false as unknown as true,
}
