import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { GetCompanyClusters } from '@/clusters/application/use-cases/GetCompanyClusters'
import { toClusterDto } from '@/clusters/infrastructure/http/clusters.controller'

@ApiTags('clusters')
@Controller('companies')
export class CompanyClustersController {
  constructor(private readonly getCompanyClusters: GetCompanyClusters) {}

  @Get(':id/clusters')
  @ApiOperation({ summary: 'List clusters that contain a given company' })
  async list(@Param('id') id: string) {
    const { clusters } = await this.getCompanyClusters.execute({
      companyId: id,
    })
    return clusters.map(toClusterDto)
  }
}
