import { describe, expect, it } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'

describe('Company', () => {
  const validInput = {
    id: '0123456-7',
    razonSocial: 'EMPRESA TEST S.A.S',
    ciiu: 'G4711',
    municipio: 'SANTA MARTA',
    tipoOrganizacion: 'SOCIEDAD',
    personal: 5,
    ingresoOperacion: 100_000_000,
    activosTotales: 200_000_000,
    email: 'test@example.com',
    telefono: '3001234567',
    direccion: 'Calle 1',
    fechaMatricula: new Date('2022-01-01'),
    fechaRenovacion: new Date('2026-01-01'),
    estado: 'ACTIVO',
  }

  it('creates with valid data and derives ciiuSeccion + ciiuDivision + ciiuGrupo', () => {
    const c = Company.create(validInput)
    expect(c.id).toBe('0123456-7')
    expect(c.ciiu).toBe('4711')
    expect(c.ciiuSeccion).toBe('G')
    expect(c.ciiuDivision).toBe('47')
    expect(c.ciiuGrupo).toBe('471')
  })

  it('strips section letter when ciiu comes as G4711', () => {
    const c = Company.create({ ...validInput, ciiu: 'G4711' })
    expect(c.ciiu).toBe('4711')
    expect(c.ciiuSeccion).toBe('G')
  })

  it('throws when razonSocial is empty', () => {
    expect(() => Company.create({ ...validInput, razonSocial: '' })).toThrow()
  })

  it('throws when razonSocial is whitespace only', () => {
    expect(() =>
      Company.create({ ...validInput, razonSocial: '   ' }),
    ).toThrow()
  })

  it('throws when id is empty', () => {
    expect(() => Company.create({ ...validInput, id: '' })).toThrow()
  })

  it('throws when ciiu is just 4 digits without section letter', () => {
    expect(() => Company.create({ ...validInput, ciiu: '4711' })).toThrow()
  })

  it('throws when ciiu has invalid format', () => {
    expect(() => Company.create({ ...validInput, ciiu: 'XX' })).toThrow()
  })

  it('derives etapa via EtapaCalculator (nacimiento for young + small)', () => {
    const c = Company.create({
      ...validInput,
      fechaMatricula: new Date('2025-06-01'),
      personal: 1,
      ingresoOperacion: 0,
    })
    expect(c.etapa).toBe('nacimiento')
  })

  it('defaults estado to ACTIVO when not provided', () => {
    const c = Company.create({
      id: 'X-1',
      razonSocial: 'X',
      ciiu: 'A0111',
      municipio: 'BOGOTA',
    })
    expect(c.estado).toBe('ACTIVO')
  })

  it('defaults numeric fields to 0 when null/undefined', () => {
    const c = Company.create({
      id: 'X-1',
      razonSocial: 'X',
      ciiu: 'A0111',
      municipio: 'BOGOTA',
    })
    expect(c.personal).toBe(0)
    expect(c.ingresoOperacion).toBe(0)
    expect(c.activosTotales).toBe(0)
  })

  it('trims razonSocial and id', () => {
    const c = Company.create({
      ...validInput,
      id: '  X-1  ',
      razonSocial: '  ACME  ',
    })
    expect(c.id).toBe('X-1')
    expect(c.razonSocial).toBe('ACME')
  })

  it('exposes all main fields via getters', () => {
    const c = Company.create(validInput)
    expect(c.municipio).toBe('SANTA MARTA')
    expect(c.tipoOrganizacion).toBe('SOCIEDAD')
    expect(c.personal).toBe(5)
    expect(c.ingresoOperacion).toBe(100_000_000)
    expect(c.activosTotales).toBe(200_000_000)
    expect(c.email).toBe('test@example.com')
    expect(c.telefono).toBe('3001234567')
    expect(c.direccion).toBe('Calle 1')
    expect(c.fechaMatricula).toEqual(new Date('2022-01-01'))
    expect(c.fechaRenovacion).toEqual(new Date('2026-01-01'))
    expect(c.estado).toBe('ACTIVO')
  })
})
