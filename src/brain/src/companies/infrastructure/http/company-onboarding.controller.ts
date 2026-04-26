import { BadRequestException, Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import {
  OnboardCompanyFromSignup,
  type YearsOfOperation,
} from '@/companies/application/use-cases/OnboardCompanyFromSignup'
import type { Company } from '@/companies/domain/entities/Company'
import type { Cluster } from '@/clusters/domain/entities/Cluster'
import type { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import {
  RELATION_TYPES,
  type RelationType,
} from '@/recommendations/domain/value-objects/RelationType'

const yearsValues: [YearsOfOperation, ...YearsOfOperation[]] = [
  'menos_1',
  '1_3',
  '3_5',
  '5_10',
  'mas_10',
]

const onboardBodySchema = z.object({
  userId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  businessName: z.string().trim().min(1),
  municipio: z.string().trim().min(1),
  yearsOfOperation: z.enum(yearsValues).optional().nullable(),
  hasChamber: z.boolean().optional(),
  nit: z.string().trim().optional().nullable(),
})

interface CompanyDto {
  id: string
  razonSocial: string
  ciiu: string
  ciiuSeccion: string
  ciiuDivision: string
  municipio: string
  etapa: string
}

interface ClusterDto {
  id: string
  codigo: string
  titulo: string
  tipo: string
  descripcion: string | null
}

interface RecommendationDto {
  id: string
  targetCompanyId: string
  score: number
  relationType: RelationType
  reasons: ReturnType<Recommendation['reasons']['toJson']>
}

interface OnboardResponse {
  company: CompanyDto
  classification: { ciiuTitulo: string; reasoning: string }
  clusters: ClusterDto[]
  recommendations: Record<RelationType, RecommendationDto[]>
}

@ApiTags('companies')
@Controller('companies')
export class CompanyOnboardingController {
  constructor(private readonly onboardUseCase: OnboardCompanyFromSignup) {}

  @Post('onboard')
  @ApiOperation({
    summary: 'Classify a business from its description and persist it',
  })
  async onboard(@Body() body: unknown): Promise<OnboardResponse> {
    const parsed = onboardBodySchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message)
    }
    const result = await this.onboardUseCase.execute({
      userId: parsed.data.userId,
      description: parsed.data.description,
      businessName: parsed.data.businessName,
      municipio: parsed.data.municipio,
      yearsOfOperation: parsed.data.yearsOfOperation ?? null,
      hasChamber: parsed.data.hasChamber,
      nit: parsed.data.nit,
    })

    return {
      company: toCompanyDto(result.company),
      classification: result.classification,
      clusters: result.clusters.map(toClusterDto),
      recommendations: groupRecs(result.recommendations),
    }
  }
}

function toCompanyDto(c: Company): CompanyDto {
  return {
    id: c.id,
    razonSocial: c.razonSocial,
    ciiu: c.ciiu,
    ciiuSeccion: c.ciiuSeccion,
    ciiuDivision: c.ciiuDivision,
    municipio: c.municipio,
    etapa: c.etapa,
  }
}

function toClusterDto(c: Cluster): ClusterDto {
  return {
    id: c.id,
    codigo: c.codigo,
    titulo: c.titulo,
    tipo: c.tipo,
    descripcion: c.descripcion,
  }
}

function groupRecs(
  recs: Recommendation[],
): Record<RelationType, RecommendationDto[]> {
  const out: Record<RelationType, RecommendationDto[]> = {
    proveedor: [],
    cliente: [],
    aliado: [],
    referente: [],
  }
  for (const rec of recs) {
    out[rec.relationType].push({
      id: rec.id,
      targetCompanyId: rec.targetCompanyId,
      score: rec.score,
      relationType: rec.relationType,
      reasons: rec.reasons.toJson(),
    })
  }
  for (const t of RELATION_TYPES) {
    out[t].sort((a, b) => b.score - a.score)
  }
  return out
}
