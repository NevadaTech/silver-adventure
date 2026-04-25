import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'

describe('DataPaths', () => {
  it('resolves CSV paths regardless of cwd', () => {
    expect(fs.existsSync(DataPaths.companiesCsv)).toBe(true)
    expect(fs.existsSync(DataPaths.clustersCsv)).toBe(true)
    expect(fs.existsSync(DataPaths.ciiuDianCsv)).toBe(true)
  })

  it('exposes all 6 expected paths', () => {
    expect(DataPaths).toMatchObject({
      ciiuDianCsv: expect.stringContaining('CIIU_DIAN.csv'),
      companiesCsv: expect.stringContaining('REGISTRADOS_SII.csv'),
      clustersCsv: expect.stringContaining('CLUSTERS.csv'),
      clusterActivitiesCsv: expect.stringContaining(
        'CLUSTERS_ACTIVIDADESECONOMICAS.csv',
      ),
      clusterSectoresCsv: expect.stringContaining(
        'CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv',
      ),
      clusterMembersCsv: expect.stringContaining(
        'CLUSTERS_POSIBLES_MIEMBROS_POR_ACTIVIDAD_PRINCIPAL_DATOS.csv',
      ),
    })
  })
})
