import { beforeEach, describe, expect, it } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { ClassifyCompanyFromDescription } from '@/companies/application/use-cases/ClassifyCompanyFromDescription'
import type { GeminiPort } from '@/shared/domain/GeminiPort'

class ScriptedGemini implements GeminiPort {
  public readonly prompts: string[] = []
  private call = 0

  constructor(private readonly responses: unknown[]) {}

  async generateText(prompt: string): Promise<string> {
    this.prompts.push(prompt)
    return JSON.stringify(this.responses[this.call++] ?? {})
  }

  async inferStructured<T>(
    prompt: string,
    validate: (raw: unknown) => T,
  ): Promise<T> {
    this.prompts.push(prompt)
    const response = this.responses[this.call++]
    return validate(response)
  }
}

const restaurant = CiiuActivity.create({
  code: '5611',
  titulo: 'Expendio a la mesa de comidas preparadas',
  seccion: 'I',
  division: '56',
  grupo: '561',
  tituloSeccion: 'Alojamiento y servicios de comida',
  tituloDivision: 'Actividades de servicios de comidas y bebidas',
  tituloGrupo: 'Actividades de restaurantes',
  macroSector: 'Servicios',
})

const retail = CiiuActivity.create({
  code: '4711',
  titulo: 'Comercio al por menor en establecimientos no especializados',
  seccion: 'G',
  division: '47',
  grupo: '471',
  tituloSeccion: 'Comercio',
  tituloDivision: 'Comercio al por menor',
  tituloGrupo: 'Establecimientos no especializados',
  macroSector: 'Comercio',
})

describe('ClassifyCompanyFromDescription', () => {
  let taxonomyRepo: InMemoryCiiuTaxonomyRepository

  beforeEach(async () => {
    taxonomyRepo = new InMemoryCiiuTaxonomyRepository([restaurant, retail])
  })

  it('returns CIIU code + taxonomy data when Gemini answers with a valid code', async () => {
    const gemini = new ScriptedGemini([
      {
        ciiuCode: '5611',
        reasoning:
          'Restaurante boutique de comida del Caribe — clase 5611 expende a la mesa.',
      },
    ])
    const useCase = new ClassifyCompanyFromDescription(gemini, taxonomyRepo)

    const result = await useCase.execute({
      description: 'Restaurante boutique en El Rodadero, comida del Caribe.',
      businessName: 'Casa Bambú',
      municipio: 'SANTA MARTA',
    })

    expect(result.ciiu.code).toBe('5611')
    expect(result.ciiu.titulo).toBe('Expendio a la mesa de comidas preparadas')
    expect(result.ciiu.seccion).toBe('I')
    expect(result.ciiu.division).toBe('56')
    expect(result.ciiu.grupo).toBe('561')
    expect(result.ciiu.macroSector).toBe('Servicios')
    expect(result.reasoning).toContain('5611')
  })

  it('passes the description, business name and municipio inside the prompt', async () => {
    const gemini = new ScriptedGemini([
      { ciiuCode: '4711', reasoning: 'tienda de barrio' },
    ])
    const useCase = new ClassifyCompanyFromDescription(gemini, taxonomyRepo)

    await useCase.execute({
      description: 'Tienda de barrio que vende víveres',
      businessName: 'Donde Doña Marta',
      municipio: 'SANTA MARTA',
    })

    const prompt = gemini.prompts[0]
    expect(prompt).toContain('Tienda de barrio que vende víveres')
    expect(prompt).toContain('Donde Doña Marta')
    expect(prompt).toContain('SANTA MARTA')
  })

  it('retries once when Gemini returns a code that does not exist in the taxonomy', async () => {
    const gemini = new ScriptedGemini([
      { ciiuCode: '9999', reasoning: 'nope' },
      { ciiuCode: '5611', reasoning: 'restaurante' },
    ])
    const useCase = new ClassifyCompanyFromDescription(gemini, taxonomyRepo)

    const result = await useCase.execute({
      description: 'Restaurante',
      businessName: 'X',
      municipio: 'SANTA MARTA',
    })

    expect(result.ciiu.code).toBe('5611')
    expect(gemini.prompts).toHaveLength(2)
    expect(gemini.prompts[1]).toContain('9999')
  })

  it('throws after the retry if the second response is also invalid', async () => {
    const gemini = new ScriptedGemini([
      { ciiuCode: '9999', reasoning: 'nope' },
      { ciiuCode: '8888', reasoning: 'still nope' },
    ])
    const useCase = new ClassifyCompanyFromDescription(gemini, taxonomyRepo)

    await expect(
      useCase.execute({
        description: 'algo raro',
        businessName: 'X',
        municipio: 'SANTA MARTA',
      }),
    ).rejects.toThrow(/CIIU/)
  })

  it('rejects empty descriptions', async () => {
    const gemini = new ScriptedGemini([])
    const useCase = new ClassifyCompanyFromDescription(gemini, taxonomyRepo)

    await expect(
      useCase.execute({
        description: '   ',
        businessName: 'X',
        municipio: 'SANTA MARTA',
      }),
    ).rejects.toThrow(/description/i)
  })

  it('throws when Gemini response shape is invalid', async () => {
    const gemini = new ScriptedGemini([{ wrong: 'shape' }])
    const useCase = new ClassifyCompanyFromDescription(gemini, taxonomyRepo)

    await expect(
      useCase.execute({
        description: 'cualquier cosa',
        businessName: 'X',
        municipio: 'SANTA MARTA',
      }),
    ).rejects.toThrow()
  })
})
