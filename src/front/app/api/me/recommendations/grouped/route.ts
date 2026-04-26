import {
  brainClient,
  BrainHttpError,
  type BrainGroupedRecommendationsResponse,
} from '@/core/shared/infrastructure/brain/brainClient'
import { mapBrainGroupedToRecomendaciones } from '@/core/recommendations/infrastructure/adapters/brainToRecomendacion'
import { enrichWithCiiuTitles } from '@/core/recommendations/infrastructure/adapters/enrichWithCiiuTitles'
import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'

export async function GET(request: Request) {
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
      recomendaciones: [],
      partial: true,
      reason: 'no_company',
    })
  }

  try {
    const grouped = await brainClient.get<BrainGroupedRecommendationsResponse>(
      `/api/companies/${encodeURIComponent(profile.company_id)}/recommendations/grouped`,
    )
    const enriched = await enrichWithCiiuTitles(grouped, supabase)
    const recomendaciones = mapBrainGroupedToRecomendaciones(enriched)
    return Response.json({
      recomendaciones,
      partial: enriched.partial,
      reason: null,
    })
  } catch (err) {
    if (err instanceof BrainHttpError) {
      serverLogger.error(
        `[GET /api/me/recommendations/grouped] Brain ${err.status}`,
        err.body,
      )
    } else {
      serverLogger.error('[GET /api/me/recommendations/grouped]', err)
    }
    return Response.json(
      { error: 'Failed to fetch recommendations' },
      { status: 502 },
    )
  }
}
