import { describe, it, expect } from 'vitest'
import { FindCiiuByCode } from '@/ciiu-taxonomy/application/use-cases/FindCiiuByCode'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'

const seedActivity = CiiuActivity.create({
  code: '4711',
  titulo: 'Comercio al por menor',
  seccion: 'G',
  division: '47',
  grupo: '471',
  tituloSeccion: 'Comercio',
  tituloDivision: 'Comercio al por menor',
  tituloGrupo: 'Establecimientos no especializados',
  macroSector: 'Servicios',
})

describe('FindCiiuByCode', () => {
  it('returns the activity when the code exists', async () => {
    const repo = new InMemoryCiiuTaxonomyRepository([seedActivity])
    const useCase = new FindCiiuByCode(repo)

    const { activity } = await useCase.execute({ code: '4711' })

    expect(activity).not.toBeNull()
    expect(activity!.code).toBe('4711')
    expect(activity!.titulo).toBe('Comercio al por menor')
  })

  it('returns null when the code does not exist', async () => {
    const repo = new InMemoryCiiuTaxonomyRepository([seedActivity])
    const useCase = new FindCiiuByCode(repo)

    const { activity } = await useCase.execute({ code: '9999' })

    expect(activity).toBeNull()
  })
})
