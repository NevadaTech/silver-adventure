import 'server-only'

import { env } from '@/core/shared/infrastructure/env'

/**
 * Server-only thin wrapper for the NestJS brain. Lives in infrastructure
 * because it adapts an external HTTP service into the BFF.
 *
 * NEVER import from a Client Component — `import 'server-only'` blocks it.
 */
export class BrainHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'BrainHttpError'
  }
}

async function brainRequest<T>(path: string, init: RequestInit): Promise<T> {
  const url = `${env.BRAIN_API_URL.replace(/\/$/, '')}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })

  const text = await response.text()
  const body = text ? safeJson(text) : null

  if (!response.ok) {
    throw new BrainHttpError(
      response.status,
      body,
      `Brain ${init.method ?? 'GET'} ${path} failed with ${response.status}`,
    )
  }

  return body as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const brainClient = {
  post<T>(path: string, body: unknown): Promise<T> {
    return brainRequest<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  get<T>(path: string): Promise<T> {
    return brainRequest<T>(path, { method: 'GET' })
  },
  delete<T>(path: string): Promise<T> {
    return brainRequest<T>(path, { method: 'DELETE' })
  },
}

export interface BrainOnboardRequest {
  userId: string
  description: string
  businessName: string
  municipio: string
  yearsOfOperation?: 'menos_1' | '1_3' | '3_5' | '5_10' | 'mas_10' | null
  hasChamber?: boolean
  nit?: string | null
}

export interface BrainOnboardResponse {
  company: {
    id: string
    razonSocial: string
    ciiu: string
    ciiuSeccion: string
    ciiuDivision: string
    municipio: string
    etapa: string
  }
  classification: { ciiuTitulo: string; reasoning: string }
  clusters: {
    id: string
    codigo: string
    titulo: string
    tipo: string
    descripcion: string | null
  }[]
  recommendations: Record<
    'proveedor' | 'cliente' | 'aliado' | 'referente',
    {
      id: string
      targetCompanyId: string
      score: number
      relationType: 'proveedor' | 'cliente' | 'aliado' | 'referente'
      reasons: {
        feature: string
        weight: number
        value?: string | number
        description: string
      }[]
    }[]
  >
}

export interface BrainGroupedRecommendationsResponse {
  proveedor: BrainRecommendationView[]
  cliente: BrainRecommendationView[]
  aliado: BrainRecommendationView[]
  referente: BrainRecommendationView[]
  partial: boolean
}

export interface BrainRecommendationView {
  id: string
  targetCompany: {
    id: string
    razonSocial: string
    ciiu: string
    ciiuSeccion: string
    ciiuDivision: string
    /**
     * Human-readable name for `ciiu` (the 4-digit class). Optional because
     * the brain itself doesn't return it — the BFF route handler enriches
     * the response from `ciiu_taxonomy` before sending it to the client.
     */
    ciiuTitulo?: string
    municipio: string
    etapa: string
    personal: number
    ingreso: number
  } | null
  relationType: 'proveedor' | 'cliente' | 'aliado' | 'referente'
  score: number
  reasons: {
    feature: string
    weight: number
    value?: string | number
    description: string
  }[]
  source: 'rule' | 'cosine' | 'ecosystem' | 'ai-inferred'
  explanation: string | null
}

export type BrainConnectionAction =
  | 'marked'
  | 'saved'
  | 'dismissed'
  | 'simulated_contact'

export interface BrainRecordConnectionRequest {
  userId: string
  recommendationId: string
  action: BrainConnectionAction
  note?: string | null
}

export interface BrainConnectionView {
  id: string
  recommendationId: string
  action: BrainConnectionAction
  note: string | null
  createdAt: string
  relationType: 'proveedor' | 'cliente' | 'aliado' | 'referente' | null
  score: number | null
  targetCompany: {
    id: string
    razonSocial: string
    ciiu: string
    ciiuSeccion: string
    municipio: string
    etapa: string
  } | null
}

export interface BrainRecordConnectionResponse {
  connection: {
    id: string
    userId: string
    recommendationId: string
    action: BrainConnectionAction
    note: string | null
    createdAt: string
  }
}

export interface BrainUserConnectionsResponse {
  connections: BrainConnectionView[]
}

export interface BrainCompanyClusterDto {
  id: string
  codigo: string
  titulo: string
  descripcion: string | null
  tipo: string
  ciiuDivision: string | null
  ciiuGrupo: string | null
  municipio: string | null
  /** Populated only for `heuristic-etapa` and `heuristic-hibrido` clusters. */
  etapa?: string | null
  memberCount: number
}

export interface BrainClusterMemberView {
  id: string
  razonSocial: string
  ciiu: string
  ciiuSeccion: string
  ciiuDivision: string
  municipio: string
  etapa: string
  isSelf: boolean
}

export interface BrainValueChainEdge {
  relationType: 'proveedor' | 'cliente' | 'aliado' | 'referente'
  count: number
  topTargets: { id: string; razonSocial: string }[]
}

export interface BrainClusterMembersResponse {
  cluster: BrainCompanyClusterDto
  members: BrainClusterMemberView[]
  valueChains: BrainValueChainEdge[]
  partial: boolean
}

export interface BrainAgentEvent {
  id: string
  companyId: string
  eventType: string
  payload: Record<string, unknown>
  read: boolean
  createdAt: string
}

export interface BrainAgentEventsResponse {
  events: BrainAgentEvent[]
}
