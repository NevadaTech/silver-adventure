import { describe, expect, it } from 'vitest'
import {
  buildClusterMappings,
  type ActivityRow,
  type SectoresRow,
} from '@/seeds/seed-cluster-mappings'

const sectores: SectoresRow[] = [
  { ciiuActividadID: '483', ciiuActividadCODIGO: '5022' },
  { ciiuActividadID: '476', ciiuActividadCODIGO: '4930' },
  { ciiuActividadID: '11', ciiuActividadCODIGO: '0122' },
  // Duplicate internal id with same code — should not break the map.
  { ciiuActividadID: '11', ciiuActividadCODIGO: '0122' },
  // Missing/blank code — should be ignored.
  { ciiuActividadID: '999', ciiuActividadCODIGO: '' },
  // Non 4-digit codes (DIAN ID badly formatted) — should be skipped.
  { ciiuActividadID: '888', ciiuActividadCODIGO: '12345' },
]

describe('buildClusterMappings', () => {
  it('joins activities to 4-digit CIIU codes via ciiuActividadID', () => {
    const activities: ActivityRow[] = [
      { clusterID: '7', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
      { clusterID: '7', ciiuID: '476', actividadClusterESTADO: 'ACTIVO' },
      { clusterID: '1', ciiuID: '11', actividadClusterESTADO: 'ACTIVO' },
    ]
    const { mappings, skipped } = buildClusterMappings(sectores, activities)
    expect(skipped).toBe(0)
    expect(mappings).toEqual([
      { clusterId: 'pred-7', ciiuCode: '5022' },
      { clusterId: 'pred-7', ciiuCode: '4930' },
      { clusterId: 'pred-1', ciiuCode: '0122' },
    ])
  })

  it('prefixes the cluster id with "pred-"', () => {
    const activities: ActivityRow[] = [
      { clusterID: '8', ciiuID: '476', actividadClusterESTADO: 'ACTIVO' },
    ]
    const { mappings } = buildClusterMappings(sectores, activities)
    expect(mappings[0]?.clusterId).toBe('pred-8')
  })

  it('skips rows whose actividadClusterESTADO is not ACTIVO', () => {
    const activities: ActivityRow[] = [
      { clusterID: '7', ciiuID: '483', actividadClusterESTADO: 'INACTIVO' },
      { clusterID: '7', ciiuID: '476', actividadClusterESTADO: 'BORRADO' },
      { clusterID: '7', ciiuID: '476' }, // missing estado entirely
      { clusterID: '7', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
    ]
    const { mappings, skipped } = buildClusterMappings(sectores, activities)
    expect(mappings).toHaveLength(1)
    expect(skipped).toBe(3)
  })

  it('skips activities whose ciiuID does not resolve via sectores', () => {
    const activities: ActivityRow[] = [
      { clusterID: '7', ciiuID: '99999', actividadClusterESTADO: 'ACTIVO' },
      { clusterID: '7', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
    ]
    const { mappings, skipped } = buildClusterMappings(sectores, activities)
    expect(mappings).toEqual([{ clusterId: 'pred-7', ciiuCode: '5022' }])
    expect(skipped).toBe(1)
  })

  it('skips rows with missing clusterID or ciiuID', () => {
    const activities: ActivityRow[] = [
      { ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
      { clusterID: '7', actividadClusterESTADO: 'ACTIVO' },
      { clusterID: '   ', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
    ]
    const { mappings, skipped } = buildClusterMappings(sectores, activities)
    expect(mappings).toHaveLength(0)
    expect(skipped).toBe(3)
  })

  it('dedups identical (cluster, ciiuCode) pairs from the activities CSV', () => {
    const activities: ActivityRow[] = [
      { clusterID: '7', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
      { clusterID: '7', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
      { clusterID: '7', ciiuID: '476', actividadClusterESTADO: 'ACTIVO' },
    ]
    const { mappings, skipped } = buildClusterMappings(sectores, activities)
    expect(mappings).toEqual([
      { clusterId: 'pred-7', ciiuCode: '5022' },
      { clusterId: 'pred-7', ciiuCode: '4930' },
    ])
    // Dedup is silent — does not increment skipped (not the same as a filtered row).
    expect(skipped).toBe(0)
  })

  it('resolves the same internal id used by different clusters independently', () => {
    const activities: ActivityRow[] = [
      { clusterID: '7', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
      { clusterID: '8', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
    ]
    const { mappings } = buildClusterMappings(sectores, activities)
    expect(mappings).toEqual([
      { clusterId: 'pred-7', ciiuCode: '5022' },
      { clusterId: 'pred-8', ciiuCode: '5022' },
    ])
  })

  it('returns empty result when sectores is empty (no resolution possible)', () => {
    const activities: ActivityRow[] = [
      { clusterID: '7', ciiuID: '483', actividadClusterESTADO: 'ACTIVO' },
    ]
    const { mappings, skipped } = buildClusterMappings([], activities)
    expect(mappings).toHaveLength(0)
    expect(skipped).toBe(1)
  })
})
