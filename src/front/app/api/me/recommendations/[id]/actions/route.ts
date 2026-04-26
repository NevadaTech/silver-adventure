import {
  brainClient,
  BrainHttpError,
  type BrainConnectionAction,
  type BrainRecordConnectionResponse,
} from '@/core/shared/infrastructure/brain/brainClient'
import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'

const VALID_ACTIONS: ReadonlySet<BrainConnectionAction> = new Set([
  'marked',
  'saved',
  'dismissed',
  'simulated_contact',
])

function readBearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  return token.length > 0 ? token : null
}

async function authenticate(
  request: Request,
): Promise<{ userId: string } | Response> {
  const token = readBearer(request)
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createSupabaseServerClient()
  const { data: userResp, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userResp.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { userId: userResp.user.id }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await authenticate(request)
  if (auth instanceof Response) return auth

  const { id } = await context.params
  if (!id || id.trim().length === 0) {
    return Response.json(
      { error: 'recommendation id is required' },
      { status: 400 },
    )
  }

  let body: { action?: string; note?: string | null }
  try {
    body = (await request.json()) as { action?: string; note?: string | null }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = (body.action ?? '').trim() as BrainConnectionAction
  if (!VALID_ACTIONS.has(action)) {
    return Response.json(
      {
        error:
          'action must be one of: marked, saved, dismissed, simulated_contact',
      },
      { status: 400 },
    )
  }

  const note =
    typeof body.note === 'string' && body.note.trim().length > 0
      ? body.note.trim()
      : null

  try {
    const result = await brainClient.post<BrainRecordConnectionResponse>(
      '/api/connections',
      {
        userId: auth.userId,
        recommendationId: id,
        action,
        note,
      },
    )
    return Response.json(result, { status: 201 })
  } catch (err) {
    return handleBrainError(err, 'POST', id)
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await authenticate(request)
  if (auth instanceof Response) return auth

  const { id } = await context.params
  if (!id || id.trim().length === 0) {
    return Response.json(
      { error: 'recommendation id is required' },
      { status: 400 },
    )
  }

  const url = new URL(request.url)
  const action = (
    url.searchParams.get('action') ?? ''
  ).trim() as BrainConnectionAction
  if (!VALID_ACTIONS.has(action)) {
    return Response.json(
      {
        error:
          'action query param must be one of: marked, saved, dismissed, simulated_contact',
      },
      { status: 400 },
    )
  }

  try {
    const params = new URLSearchParams({
      userId: auth.userId,
      recommendationId: id,
      action,
    })
    await brainClient.delete<unknown>(`/api/connections?${params.toString()}`)
    return new Response(null, { status: 204 })
  } catch (err) {
    return handleBrainError(err, 'DELETE', id)
  }
}

function handleBrainError(err: unknown, method: string, id: string): Response {
  if (err instanceof BrainHttpError) {
    serverLogger.error(
      `[${method} /api/me/recommendations/${id}/actions] Brain ${err.status}`,
      err.body,
    )
    if (err.status === 404) {
      return Response.json(
        { error: 'Recommendation not found' },
        { status: 404 },
      )
    }
    if (err.status === 400) {
      return Response.json(err.body ?? { error: 'Bad Request' }, {
        status: 400,
      })
    }
  } else {
    serverLogger.error(`[${method} /api/me/recommendations/${id}/actions]`, err)
  }
  return Response.json({ error: 'Failed to record action' }, { status: 502 })
}
