import { afterEach, describe, expect, it, vi } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import { CsvCompanySource } from '@/companies/infrastructure/sources/CsvCompanySource'
import { CsvLoader } from '@/shared/infrastructure/csv/CsvLoader'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CsvCompanySource', () => {
  describe('against the real REGISTRADOS_SII.csv', () => {
    it('reads the file and returns Company entities', async () => {
      const source = new CsvCompanySource()
      const companies = await source.fetchAll()
      expect(companies.length).toBeGreaterThan(9000)
      expect(companies[0]).toBeInstanceOf(Company)
      expect(companies[0].ciiuDivision).toMatch(/^\d{2}$/)
      expect(companies[0].ciiuSeccion).toMatch(/^[A-Z]$/)
    })

    it('fetchUpdatedSince filters by fechaRenovacion', async () => {
      const source = new CsvCompanySource()
      const all = await source.fetchAll()
      const recent = await source.fetchUpdatedSince(new Date('2024-01-01'))
      expect(recent.length).toBeLessThanOrEqual(all.length)
      for (const c of recent) {
        expect(c.fechaRenovacion).not.toBeNull()
        expect(c.fechaRenovacion!.getTime()).toBeGreaterThan(
          new Date('2024-01-01').getTime(),
        )
      }
    })
  })

  describe('row mapping', () => {
    it('skips rows whose CIIU does not match the X9999 pattern', async () => {
      vi.spyOn(CsvLoader, 'load').mockResolvedValueOnce([
        // valid row
        {
          registradosCIIU1_CODIGOSII: 'G4711',
          registradoMATRICULA: '1',
          registradoRAZONSOCIAL: 'OK',
          municipioTitulo: 'BOGOTA',
        },
        // invalid CIIU (no section letter)
        {
          registradosCIIU1_CODIGOSII: '4711',
          registradoMATRICULA: '2',
          registradoRAZONSOCIAL: 'BAD',
          municipioTitulo: 'BOGOTA',
        },
        // empty CIIU
        {
          registradosCIIU1_CODIGOSII: '',
          registradoMATRICULA: '3',
          registradoRAZONSOCIAL: 'BAD2',
          municipioTitulo: 'BOGOTA',
        },
      ])
      const source = new CsvCompanySource()
      const companies = await source.fetchAll()
      expect(companies).toHaveLength(1)
      expect(companies[0].id).toBe('1')
    })

    it('parses YYYYMMDD date strings into Date objects', async () => {
      vi.spyOn(CsvLoader, 'load').mockResolvedValueOnce([
        {
          registradosCIIU1_CODIGOSII: 'G4711',
          registradoMATRICULA: '1',
          registradoRAZONSOCIAL: 'X',
          municipioTitulo: 'BOGOTA',
          regitradoFECMATRICULA: '19920825',
          regitradoFECHREN: '20260101',
        },
      ])
      const source = new CsvCompanySource()
      const [c] = await source.fetchAll()
      expect(c.fechaMatricula).toEqual(new Date(Date.UTC(1992, 7, 25)))
      expect(c.fechaRenovacion).toEqual(new Date(Date.UTC(2026, 0, 1)))
    })

    it('treats empty or malformed date strings as null', async () => {
      vi.spyOn(CsvLoader, 'load').mockResolvedValueOnce([
        {
          registradosCIIU1_CODIGOSII: 'G4711',
          registradoMATRICULA: '1',
          registradoRAZONSOCIAL: 'X',
          municipioTitulo: 'BOGOTA',
          regitradoFECMATRICULA: '',
          regitradoFECHREN: 'garbage',
        },
      ])
      const source = new CsvCompanySource()
      const [c] = await source.fetchAll()
      expect(c.fechaMatricula).toBeNull()
      expect(c.fechaRenovacion).toBeNull()
    })

    it('treats empty numeric strings as 0', async () => {
      vi.spyOn(CsvLoader, 'load').mockResolvedValueOnce([
        {
          registradosCIIU1_CODIGOSII: 'G4711',
          registradoMATRICULA: '1',
          registradoRAZONSOCIAL: 'X',
          municipioTitulo: 'BOGOTA',
          regitradoPERSONAL: '',
          registradoINGRESOPERACION: '',
          registradoACTIVOSTOTALES: '',
        },
      ])
      const source = new CsvCompanySource()
      const [c] = await source.fetchAll()
      expect(c.personal).toBe(0)
      expect(c.ingresoOperacion).toBe(0)
      expect(c.activosTotales).toBe(0)
    })

    it('maps optional contact fields, leaving null for empty values', async () => {
      vi.spyOn(CsvLoader, 'load').mockResolvedValueOnce([
        {
          registradosCIIU1_CODIGOSII: 'G4711',
          registradoMATRICULA: '1',
          registradoRAZONSOCIAL: 'X',
          municipioTitulo: 'BOGOTA',
          regitradoEMAIL: 'x@y.com',
          regitradoTELEFONO1: '300',
          regitradoDIRECCION: '',
        },
      ])
      const source = new CsvCompanySource()
      const [c] = await source.fetchAll()
      expect(c.email).toBe('x@y.com')
      expect(c.telefono).toBe('300')
      expect(c.direccion).toBeNull()
    })

    it('uses tipoOrganizacionTITULO and registroEstadoTITULO for human-readable fields', async () => {
      vi.spyOn(CsvLoader, 'load').mockResolvedValueOnce([
        {
          registradosCIIU1_CODIGOSII: 'G4711',
          registradoMATRICULA: '1',
          registradoRAZONSOCIAL: 'X',
          municipioTitulo: 'BOGOTA',
          tipoOrganizacionTITULO: 'Sociedad Limitada',
          registroEstadoTITULO: 'Matricula Activa',
        },
      ])
      const source = new CsvCompanySource()
      const [c] = await source.fetchAll()
      expect(c.tipoOrganizacion).toBe('Sociedad Limitada')
      expect(c.estado).toBe('Matricula Activa')
    })
  })
})
