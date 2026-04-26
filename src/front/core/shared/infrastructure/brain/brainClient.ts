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
