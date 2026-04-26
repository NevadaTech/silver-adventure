import {
  brainClient,
  BrainHttpError,
} from '@/core/shared/infrastructure/brain/brainClient'
import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
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

  const { id } = await context.params
  if (!id || id.trim().length === 0) {
    return Response.json({ error: 'event id is required' }, { status: 400 })
  }

  try {
    await brainClient.post(
      `/api/agent/events/${encodeURIComponent(id)}/read`,
      {},
    )
    return new Response(null, { status: 204 })
  } catch (err) {
    if (err instanceof BrainHttpError) {
      serverLogger.error(
        `[POST /api/me/events/${id}/read] Brain ${err.status}`,
        err.body,
      )
    } else {
      serverLogger.error(`[POST /api/me/events/${id}/read]`, err)
    }
    return Response.json(
      { error: 'Failed to mark event as read' },
      { status: 502 },
    )
  }
}
