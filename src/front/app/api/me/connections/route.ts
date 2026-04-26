import {
  brainClient,
  BrainHttpError,
  type BrainUserConnectionsResponse,
} from '@/core/shared/infrastructure/brain/brainClient'
import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'

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

  const userId = userResp.user.id

  try {
    const result = await brainClient.get<BrainUserConnectionsResponse>(
      `/api/users/${encodeURIComponent(userId)}/connections`,
    )
    return Response.json(result)
  } catch (err) {
    if (err instanceof BrainHttpError) {
      serverLogger.error(
        `[GET /api/me/connections] Brain ${err.status}`,
        err.body,
      )
    } else {
      serverLogger.error('[GET /api/me/connections]', err)
    }
    return Response.json(
      { error: 'Failed to load connections' },
      { status: 502 },
    )
  }
}
