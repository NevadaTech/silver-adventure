/* eslint-disable no-console */
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { SupabaseClusterRepository } from '@/clusters/infrastructure/repositories/SupabaseClusterRepository'
import { CsvLoader } from '@/shared/infrastructure/csv/CsvLoader'
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'
import { createBrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

interface ClusterRow {
  clusterID: string
  clusterCODIGO: string
  clusterTITULO: string
  clusterDESCRIPCION?: string
  clusterESTADO: string
}

export interface SeedPredefinedClustersResult {
  inserted: number
  skipped: number
  repo: SupabaseClusterRepository
}

export async function seedPredefinedClusters(): Promise<SeedPredefinedClustersResult> {
  const rows = await CsvLoader.load<ClusterRow>(DataPaths.clustersCsv)

  let skipped = 0
  const clusters: Cluster[] = []
  for (const row of rows) {
    if (row.clusterESTADO !== 'ACTIVO') {
      skipped++
      continue
    }
    const id = row.clusterID?.trim()
    const codigo = row.clusterCODIGO?.trim()
    const titulo = row.clusterTITULO?.trim()
    if (!id || !codigo || !titulo) {
      skipped++
      continue
    }
    clusters.push(
      Cluster.create({
        id: `pred-${id}`,
        codigo,
        titulo,
        descripcion: row.clusterDESCRIPCION?.trim() || null,
        tipo: 'predefined',
        macroSector: null,
        memberCount: 0,
      }),
    )
  }

  const repo = new SupabaseClusterRepository(createBrainSupabaseClient())
  await repo.saveMany(clusters)

  return { inserted: clusters.length, skipped, repo }
}

if (require.main === module) {
  seedPredefinedClusters()
    .then(async ({ inserted, skipped, repo }) => {
      console.log(
        `✅ Seeded ${inserted} predefined clusters (skipped ${skipped} non-active rows)`,
      )
      const total = await repo.findByTipo('predefined')
      console.log(
        `🔎 Round-trip OK — predefined clusters in DB: ${total.length} (${total.map((c) => c.codigo).join(', ')})`,
      )
      process.exit(inserted > 0 && total.length >= inserted ? 0 : 1)
    })
    .catch((err) => {
      console.error('❌ Seed predefined clusters failed:', err)
      process.exit(1)
    })
}
