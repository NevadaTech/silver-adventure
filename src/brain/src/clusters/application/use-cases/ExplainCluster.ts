import { Inject, Injectable } from '@nestjs/common'
import {
  CLUSTER_MEMBERSHIP_REPOSITORY,
  type ClusterMembershipRepository,
} from '@/clusters/domain/repositories/ClusterMembershipRepository'
import {
  CLUSTER_REPOSITORY,
  type ClusterRepository,
} from '@/clusters/domain/repositories/ClusterRepository'
import type { Cluster } from '@/clusters/domain/entities/Cluster'
import {
  COMPANY_REPOSITORY,
  type CompanyRepository,
} from '@/companies/domain/repositories/CompanyRepository'
import type { LlmPort } from '@/shared/domain/LlmPort'
import { LLM_PORT } from '@/shared/shared.module'
import type { UseCase } from '@/shared/domain/UseCase'

export interface ExplainClusterInput {
  clusterId: string
}

export interface ExplainClusterOutput {
  description: string
}

const SAMPLE_SIZE = 3

@Injectable()
export class ExplainCluster implements UseCase<
  ExplainClusterInput,
  ExplainClusterOutput
> {
  constructor(
    @Inject(CLUSTER_REPOSITORY)
    private readonly clusterRepo: ClusterRepository,
    @Inject(CLUSTER_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: ClusterMembershipRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
    @Inject(LLM_PORT)
    private readonly gemini: LlmPort,
  ) {}

  async execute({
    clusterId,
  }: ExplainClusterInput): Promise<ExplainClusterOutput> {
    const cluster = await this.clusterRepo.findById(clusterId)
    if (!cluster) {
      throw new Error(`Cluster '${clusterId}' not found`)
    }
    if (cluster.descripcion) {
      return { description: cluster.descripcion }
    }

    const examples = await this.collectExamples(clusterId)
    const prompt = buildPrompt(cluster, examples)
    const description = (await this.gemini.generateText(prompt)).trim()

    await this.clusterRepo.updateDescripcion(clusterId, description)
    return { description }
  }

  private async collectExamples(clusterId: string): Promise<string[]> {
    const companyIds =
      await this.membershipRepo.findCompanyIdsByCluster(clusterId)
    const sample = pickRandom(companyIds, SAMPLE_SIZE)
    const companies = await Promise.all(
      sample.map((id) => this.companyRepo.findById(id)),
    )
    return companies
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => c.razonSocial)
  }
}

function buildPrompt(cluster: Cluster, examples: string[]): string {
  const lines = [
    'Sos un consultor empresarial. Te paso un cluster de empresas y necesito que generes',
    'una descripción de 2-3 frases explicando qué tienen en común y qué oportunidades de',
    'negocio podrían surgir entre ellas.',
    '',
    `Cluster: ${cluster.titulo}`,
    `Tipo: ${cluster.tipo}`,
  ]
  if (cluster.ciiuDivision) {
    lines.push(`División CIIU: ${cluster.ciiuDivision}`)
  }
  if (cluster.ciiuGrupo) {
    lines.push(`Grupo CIIU: ${cluster.ciiuGrupo}`)
  }
  if (cluster.municipio) {
    lines.push(`Municipio: ${cluster.municipio}`)
  }
  lines.push(`Cantidad de empresas: ${cluster.memberCount}`)
  if (examples.length > 0) {
    lines.push(`Ejemplos: ${examples.join(', ')}`)
  }
  lines.push('', 'Responde en español, tono profesional pero cercano.')
  return lines.join('\n')
}

function pickRandom<T>(items: T[], n: number): T[] {
  if (items.length <= n) return [...items]
  const copy = [...items]
  const out: T[] = []
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy[idx])
    copy.splice(idx, 1)
  }
  return out
}
