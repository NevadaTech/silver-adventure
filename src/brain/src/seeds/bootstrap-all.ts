/* eslint-disable no-console */
import { seedCiiuTaxonomy } from '@/seeds/seed-ciiu-taxonomy'
import { seedCompanies } from '@/seeds/seed-companies'
import { seedPredefinedClusters } from '@/seeds/seed-predefined-clusters'
import { seedClusterMappings } from '@/seeds/seed-cluster-mappings'

async function main(): Promise<void> {
  console.log('🚀 Bootstrapping brain database...')

  console.log('\nStep 1/4: CIIU DIAN taxonomy')
  const ciiu = await seedCiiuTaxonomy()
  console.log(
    `  → ${ciiu.inserted} activities seeded (skipped ${ciiu.skipped})`,
  )

  console.log('\nStep 2/4: Companies')
  const companies = await seedCompanies()
  console.log(`  → ${companies.inserted} companies seeded`)

  console.log('\nStep 3/4: Predefined clusters')
  const clusters = await seedPredefinedClusters()
  console.log(
    `  → ${clusters.inserted} predefined clusters seeded (skipped ${clusters.skipped})`,
  )

  console.log('\nStep 4/4: Cluster CIIU mappings')
  const mappings = await seedClusterMappings()
  console.log(
    `  → ${mappings.inserted} cluster→CIIU mappings seeded (skipped ${mappings.skipped})`,
  )

  console.log('\n✅ Bootstrap complete')
}

main().catch((err: unknown) => {
  console.error('❌ Bootstrap failed:', err)
  process.exit(1)
})
