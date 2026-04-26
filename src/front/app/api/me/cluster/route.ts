import {
  brainClient,
  BrainHttpError,
  type BrainClusterMembersResponse,
  type BrainCompanyClusterDto,
} from '@/core/shared/infrastructure/brain/brainClient'
import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'

interface MeClusterResponse {
  cluster: BrainClusterMembersResponse | null
  reason: 'no_company' | 'no_cluster' | null
}

/**
 * Returns the user's "primary" cluster + its members + the user's value-chain
 * edges that fall inside the cluster. Picking strategy:
 *   1) Largest predefined cluster (by member count).
 *   2) Otherwise, the cluster the company belongs to with the highest member count.
 *   3) If the user has no company yet, returns 200 with `cluster=null` and a hint.
 */
export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServerClient()
  const { data: userResp, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userResp.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', userResp.user.id)
    .single()

  if (profileErr || !profile?.company_id) {
    const body: MeClusterResponse = { cluster: null, reason: 'no_company' }
    return Response.json(body)
  }

  const companyId = profile.company_id

  try {
    const clusters = await brainClient.get<BrainCompanyClusterDto[]>(
      `/api/companies/${encodeURIComponent(companyId)}/clusters`,
    )
    if (clusters.length === 0) {
      const body: MeClusterResponse = { cluster: null, reason: 'no_cluster' }
      return Response.json(body)
    }

    const primary = pickPrimary(clusters)
    const detail = await brainClient.get<BrainClusterMembersResponse>(
      `/api/clusters/${encodeURIComponent(primary.id)}/members?perspectiveCompanyId=${encodeURIComponent(companyId)}`,
    )

    return Response.json({ cluster: detail, reason: null })
  } catch (err) {
    if (err instanceof BrainHttpError) {
      serverLogger.error(`[GET /api/me/cluster] Brain ${err.status}`, err.body)
    } else {
      serverLogger.error('[GET /api/me/cluster]', err)
    }
    return Response.json({ error: 'Failed to load cluster' }, { status: 502 })
  }
}

function pickPrimary(
  clusters: BrainCompanyClusterDto[],
): BrainCompanyClusterDto {
  const predefined = clusters
    .filter((c) => c.tipo === 'predefined')
    .sort((a, b) => b.memberCount - a.memberCount)
  if (predefined.length > 0) return predefined[0]
  return [...clusters].sort((a, b) => b.memberCount - a.memberCount)[0]
}
