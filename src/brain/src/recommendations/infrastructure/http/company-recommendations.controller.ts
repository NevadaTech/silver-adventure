import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  GetCompanyRecommendations,
  type GetCompanyRecommendationsResult,
} from '@/recommendations/application/use-cases/GetCompanyRecommendations'
import {
  isRelationType,
  type RelationType,
} from '@/recommendations/domain/value-objects/RelationType'

@ApiTags('recommendations')
@Controller('companies')
export class CompanyRecommendationsController {
  constructor(
    private readonly getCompanyRecommendations: GetCompanyRecommendations,
  ) {}

  @Get(':id/recommendations')
  @ApiOperation({ summary: 'List recommendations for a given company' })
  async list(
    @Param('id') id: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ): Promise<GetCompanyRecommendationsResult> {
    const relationType =
      type && isRelationType(type) ? (type as RelationType) : undefined
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    const safeLimit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : undefined

    return this.getCompanyRecommendations.execute({
      companyId: id,
      type: relationType,
      limit: safeLimit,
    })
  }
}
