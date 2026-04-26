/* eslint-disable no-console */
import type { ClusterCiiuMapping } from '@/clusters/domain/repositories/ClusterCiiuMappingRepository'
import { SupabaseClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/SupabaseClusterCiiuMappingRepository'
import { CsvLoader } from '@/shared/infrastructure/csv/CsvLoader'
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'
import { createBrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

export interface SectoresRow {
  ciiuActividadID?: string
  ciiuActividadCODIGO?: string
}

export interface ActivityRow {
  clusterID?: string
  ciiuID?: string
  actividadClusterESTADO?: string
}

const VALID_CODE = /^\d{4}$/

export interface BuildMappingsResult {
  mappings: ClusterCiiuMapping[]
  skipped: number
}

/**
 * Pure join: builds `pred-<clusterID>` → 4-digit CIIU mappings by resolving
 * `ActivityRow.ciiuID` (DIAN internal numeric id) against `SectoresRow`'s
 * `ciiuActividadID → ciiuActividadCODIGO`. Skips inactive rows, missing keys,
 * unresolved internal ids, and dedups identical (cluster, code) pairs.
 */
export function buildClusterMappings(
  sectores: SectoresRow[],
  activities: ActivityRow[],
): BuildMappingsResult {
  const idToCode = new Map<string, string>()
  for (const row of sectores) {
    const id = row.ciiuActividadID?.trim()
    const code = row.ciiuActividadCODIGO?.trim()
    if (!id || !code || !VALID_CODE.test(code)) continue
    if (!idToCode.has(id)) idToCode.set(id, code)
  }

  let skipped = 0
  const seen = new Set<string>()
  const mappings: ClusterCiiuMapping[] = []
  for (const row of activities) {
    if (row.actividadClusterESTADO !== 'ACTIVO') {
      skipped++
      continue
    }
    const clusterId = row.clusterID?.trim()
    const internalId = row.ciiuID?.trim()
    if (!clusterId || !internalId) {
      skipped++
      continue
    }
    const ciiuCode = idToCode.get(internalId)
    if (!ciiuCode) {
      skipped++
      continue
    }
    const fullClusterId = `pred-${clusterId}`
    const dedupKey = `${fullClusterId}|${ciiuCode}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    mappings.push({ clusterId: fullClusterId, ciiuCode })
  }

  return { mappings, skipped }
}

export interface SeedClusterMappingsResult {
  inserted: number
  skipped: number
  repo: SupabaseClusterCiiuMappingRepository
}

export async function seedClusterMappings(): Promise<SeedClusterMappingsResult> {
  const sectores = await CsvLoader.load<SectoresRow>(
    DataPaths.clusterSectoresCsv,
  )
  const activities = await CsvLoader.load<ActivityRow>(
    DataPaths.clusterActivitiesCsv,
  )

  const { mappings, skipped } = buildClusterMappings(sectores, activities)

  const repo = new SupabaseClusterCiiuMappingRepository(
    createBrainSupabaseClient(),
  )
  await repo.saveMany(mappings)

  return { inserted: mappings.length, skipped, repo }
}

if (require.main === module) {
  seedClusterMappings()
    .then(async ({ inserted, skipped, repo }) => {
      console.log(
        `✅ Seeded ${inserted} cluster→CIIU mappings (skipped ${skipped} rows)`,
      )
      const total = await repo.count()
      const map = await repo.getCiiuToClusterMap()
      console.log(
        `🔎 Round-trip OK — mapping rows: ${total}, distinct ciiu codes: ${map.size}`,
      )
      process.exit(inserted > 0 && total >= inserted ? 0 : 1)
    })
    .catch((err) => {
      console.error('❌ Seed cluster mappings failed:', err)
      process.exit(1)
    })
}
