import { describe, it, expect } from 'vitest'
import { CsvLoader } from '@/shared/infrastructure/csv/CsvLoader'
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'

describe('CsvLoader', () => {
  it('loads REGISTRADOS_SII.csv and returns 10000 rows', async () => {
    const rows = await CsvLoader.load(DataPaths.companiesCsv)
    expect(rows.length).toBeGreaterThanOrEqual(9000)
    expect(rows[0]).toHaveProperty('registradoMATRICULA')
    expect(rows[0]).toHaveProperty('registradosCIIU1_CODIGOSII')
  })

  it('handles UTF-8 with quoted commas correctly', async () => {
    const rows = await CsvLoader.load<Record<string, string>>(
      DataPaths.clusterMembersCsv,
    )
    expect(rows.length).toBeGreaterThan(0)
    const agroRow = rows.find(
      (r) =>
        typeof r.ciiuSeccionTITULO === 'string' &&
        r.ciiuSeccionTITULO.includes('AGRICULTURA'),
    )
    expect(agroRow).toBeDefined()
  })

  it('applies optional row mapper', async () => {
    type Mapped = { id: string; razon: string }
    const rows = await CsvLoader.load<Mapped>(
      DataPaths.companiesCsv,
      (row) => ({
        id: row.registradoMATRICULA,
        razon: row.registradoRAZONSOCIAL,
      }),
    )
    expect(rows[0].id).toBeTruthy()
    expect(rows[0].razon).toBeTruthy()
  })
})
