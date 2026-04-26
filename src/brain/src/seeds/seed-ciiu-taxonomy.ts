/* eslint-disable no-console */
import { CsvLoader } from '@/shared/infrastructure/csv/CsvLoader'
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { createBrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'
import { SupabaseCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/SupabaseCiiuTaxonomyRepository'

interface CiiuRow {
  code: string
  seccion: string
  division: string
  grupo: string
  titulo_actividad: string
  titulo_seccion: string
  titulo_division: string
  titulo_grupo: string
  macro_sector?: string
}

export interface SeedResult {
  inserted: number
  skipped: number
  repo: SupabaseCiiuTaxonomyRepository
}

// CIIU_DIAN.csv ships with a second pseudo-header row (`Clase,,,Grupo,...`)
// after the real header. Filter anything whose code isn't a 4-digit string
// before handing it to the entity factory — same invariant as CiiuActivity.
const VALID_CODE = /^\d{4}$/

export async function seedCiiuTaxonomy(): Promise<SeedResult> {
  const rows = await CsvLoader.load<CiiuRow>(DataPaths.ciiuDianCsv)

  let skipped = 0
  const activities: CiiuActivity[] = []
  for (const r of rows) {
    if (!VALID_CODE.test(r.code ?? '')) {
      skipped++
      continue
    }
    activities.push(
      CiiuActivity.create({
        code: r.code,
        titulo: r.titulo_actividad,
        seccion: r.seccion,
        division: r.division,
        grupo: r.grupo,
        tituloSeccion: r.titulo_seccion,
        tituloDivision: r.titulo_division,
        tituloGrupo: r.titulo_grupo,
        macroSector: r.macro_sector?.trim() || null,
      }),
    )
  }

  const repo = new SupabaseCiiuTaxonomyRepository(createBrainSupabaseClient())
  await repo.saveAll(activities)
  return { inserted: activities.length, skipped, repo }
}

if (require.main === module) {
  seedCiiuTaxonomy()
    .then(async ({ inserted, skipped, repo }) => {
      console.log(
        `✅ Seeded ${inserted} CIIU activities (skipped ${skipped} non-numeric rows)`,
      )
      const probe = await repo.findByCode('4711')
      console.log(
        probe
          ? `🔎 Round-trip OK — 4711 → "${probe.titulo}" (seccion ${probe.seccion} / ${probe.tituloSeccion})`
          : '⚠️  Round-trip FAILED — code 4711 not found after seed',
      )
      process.exit(probe ? 0 : 1)
    })
    .catch((err) => {
      console.error('❌ Seed failed:', err)
      process.exit(1)
    })
}
