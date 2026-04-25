import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'

export const CIIU_TAXONOMY_REPOSITORY = Symbol('CIIU_TAXONOMY_REPOSITORY')

export interface CiiuTaxonomyRepository {
  findByCode(code: string): Promise<CiiuActivity | null>
  findByCodes(codes: string[]): Promise<CiiuActivity[]>
  findBySection(seccion: string): Promise<CiiuActivity[]>
  findByDivision(division: string): Promise<CiiuActivity[]>
  findByGrupo(grupo: string): Promise<CiiuActivity[]>
  saveAll(activities: CiiuActivity[]): Promise<void>
}
