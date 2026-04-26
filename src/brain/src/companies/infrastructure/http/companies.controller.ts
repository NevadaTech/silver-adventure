import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Company } from '@/companies/domain/entities/Company'
import { FindCompanyById } from '@/companies/application/use-cases/FindCompanyById'
import { GetCompanies } from '@/companies/application/use-cases/GetCompanies'

const DEFAULT_LIMIT = 50

interface CompanyDto {
  id: string
  razonSocial: string
  ciiu: string
  ciiuSeccion: string
  ciiuDivision: string
  municipio: string
  etapa: string
  personal: number
  ingreso: number
}

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly getCompanies: GetCompanies,
    private readonly findCompanyById: FindCompanyById,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List companies' })
  async list(@Query('limit') limit?: string): Promise<CompanyDto[]> {
    const { companies } = await this.getCompanies.execute()
    const max = limit ? parseInt(limit, 10) : DEFAULT_LIMIT
    return companies.slice(0, max).map(toDto)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company by id' })
  async detail(@Param('id') id: string): Promise<CompanyDto> {
    const { company } = await this.findCompanyById.execute({ id })
    if (!company) throw new NotFoundException(`Company ${id} not found`)
    return toDto(company)
  }
}

function toDto(c: Company): CompanyDto {
  return {
    id: c.id,
    razonSocial: c.razonSocial,
    ciiu: c.ciiu,
    ciiuSeccion: c.ciiuSeccion,
    ciiuDivision: c.ciiuDivision,
    municipio: c.municipio,
    etapa: c.etapa,
    personal: c.personal,
    ingreso: c.ingresoOperacion,
  }
}
