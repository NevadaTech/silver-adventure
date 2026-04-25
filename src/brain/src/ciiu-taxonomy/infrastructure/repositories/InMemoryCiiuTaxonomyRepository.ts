import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { CiiuTaxonomyRepository } from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'

export class InMemoryCiiuTaxonomyRepository implements CiiuTaxonomyRepository {
  private store = new Map<string, CiiuActivity>()

  constructor(seed: CiiuActivity[] = []) {
    for (const a of seed) this.store.set(a.code, a)
  }

  async findByCode(code: string): Promise<CiiuActivity | null> {
    return this.store.get(code) ?? null
  }

  async findByCodes(codes: string[]): Promise<CiiuActivity[]> {
    return codes
      .map((c) => this.store.get(c))
      .filter((a): a is CiiuActivity => a !== undefined)
  }

  async findBySection(seccion: string): Promise<CiiuActivity[]> {
    return [...this.store.values()].filter((a) => a.seccion === seccion)
  }

  async findByDivision(division: string): Promise<CiiuActivity[]> {
    return [...this.store.values()].filter((a) => a.division === division)
  }

  async findByGrupo(grupo: string): Promise<CiiuActivity[]> {
    return [...this.store.values()].filter((a) => a.grupo === grupo)
  }

  async saveAll(activities: CiiuActivity[]): Promise<void> {
    for (const a of activities) this.store.set(a.code, a)
  }
}
