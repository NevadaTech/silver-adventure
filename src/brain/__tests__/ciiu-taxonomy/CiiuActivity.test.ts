import { describe, it, expect } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'

const validData = {
  code: '4711',
  titulo: 'Comercio al por menor en establecimientos no especializados',
  seccion: 'G',
  division: '47',
  grupo: '471',
  tituloSeccion: 'Comercio',
  tituloDivision: 'Comercio al por menor',
  tituloGrupo: 'Establecimientos no especializados',
  macroSector: 'Servicios',
}

describe('CiiuActivity', () => {
  it('creates a valid activity exposing all fields via getters', () => {
    const a = CiiuActivity.create(validData)
    expect(a.code).toBe('4711')
    expect(a.titulo).toBe(validData.titulo)
    expect(a.seccion).toBe('G')
    expect(a.division).toBe('47')
    expect(a.grupo).toBe('471')
    expect(a.tituloSeccion).toBe('Comercio')
    expect(a.tituloDivision).toBe('Comercio al por menor')
    expect(a.tituloGrupo).toBe('Establecimientos no especializados')
    expect(a.macroSector).toBe('Servicios')
  })

  it('defaults macroSector to null when omitted', () => {
    const { macroSector: _omit, ...rest } = validData
    const a = CiiuActivity.create(rest)
    expect(a.macroSector).toBeNull()
  })

  it('treats explicit null macroSector as null', () => {
    const a = CiiuActivity.create({ ...validData, macroSector: null })
    expect(a.macroSector).toBeNull()
  })

  it('throws when code is not 4 digits', () => {
    expect(() => CiiuActivity.create({ ...validData, code: '47' })).toThrow(
      /4 digits/,
    )
    expect(() => CiiuActivity.create({ ...validData, code: '47111' })).toThrow(
      /4 digits/,
    )
    expect(() => CiiuActivity.create({ ...validData, code: 'abcd' })).toThrow(
      /4 digits/,
    )
  })

  it('throws when seccion is not a single uppercase letter', () => {
    expect(() => CiiuActivity.create({ ...validData, seccion: 'XX' })).toThrow(
      /single uppercase letter/,
    )
    expect(() => CiiuActivity.create({ ...validData, seccion: 'g' })).toThrow(
      /single uppercase letter/,
    )
    expect(() => CiiuActivity.create({ ...validData, seccion: '1' })).toThrow(
      /single uppercase letter/,
    )
  })

  it('throws when division is not 2 digits', () => {
    expect(() => CiiuActivity.create({ ...validData, division: '4' })).toThrow(
      /2 digits/,
    )
    expect(() =>
      CiiuActivity.create({ ...validData, division: '477' }),
    ).toThrow(/2 digits/)
  })

  it('inherits identity equality from Entity (equal when codes match)', () => {
    const a = CiiuActivity.create(validData)
    const b = CiiuActivity.create({ ...validData, titulo: 'distinto' })
    expect(a.equals(b)).toBe(true)
  })

  it('considers activities different when codes differ', () => {
    const a = CiiuActivity.create({ ...validData, code: '4711' })
    const b = CiiuActivity.create({ ...validData, code: '4712' })
    expect(a.equals(b)).toBe(false)
  })
})
