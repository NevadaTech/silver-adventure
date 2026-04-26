import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ExplainRecommendation } from '@/recommendations/application/use-cases/ExplainRecommendation'
import {
  GenerateRecommendations,
  type GenerateRecommendationsResult,
} from '@/recommendations/application/use-cases/GenerateRecommendations'

interface GenerateRequest {
  enableAi?: boolean
}

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly generateRecommendations: GenerateRecommendations,
    private readonly explainRecommendation: ExplainRecommendation,
  ) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Regenerate recommendations for every active company',
  })
  async generate(
    @Body() body: GenerateRequest = {},
  ): Promise<GenerateRecommendationsResult> {
    return this.generateRecommendations.execute({ enableAi: body.enableAi })
  }

  @Post(':id/explain')
  @ApiOperation({
    summary: 'Generate or return cached natural-language explanation',
  })
  async explain(@Param('id') id: string): Promise<{ explanation: string }> {
    try {
      return await this.explainRecommendation.execute({ recommendationId: id })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message.startsWith('Recommendation not found')) {
        throw new NotFoundException(message)
      }
      throw e
    }
  }
}
