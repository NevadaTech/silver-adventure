import {
  brainClient,
  BrainHttpError,
  type BrainAgentEventsResponse,
} from '@/core/shared/infrastructure/brain/brainClient'
import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'

const DEFAULT_LIMIT = 20

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
    return Response.json({
      events: [],
      reason: 'no_company',
    })
  }

  const url = new URL(request.url)
  const unread = url.searchParams.get('unread') === 'true'
  const rawLimit = url.searchParams.get('limit')
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : DEFAULT_LIMIT
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200
      ? parsedLimit
      : DEFAULT_LIMIT

  try {
    const params = new URLSearchParams({
      companyId: profile.company_id,
      limit: String(limit),
    })
    if (unread) params.set('unread', 'true')
    const result = await brainClient.get<BrainAgentEventsResponse>(
      `/api/agent/events?${params.toString()}`,
    )
    return Response.json({ ...result, reason: null })
  } catch (err) {
    if (err instanceof BrainHttpError) {
      serverLogger.error(`[GET /api/me/events] Brain ${err.status}`, err.body)
    } else {
      serverLogger.error('[GET /api/me/events]', err)
    }
    return Response.json({ error: 'Failed to load events' }, { status: 502 })
  }
}
