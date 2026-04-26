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
    .select('id, name, email, sector, barrio, municipio, company_id')
    .eq('id', userResp.user.id)
    .single()

  if (profileErr || !profile) {
    serverLogger.warn(
      `[GET /api/me] No profile for auth user ${userResp.user.id}`,
      profileErr,
    )
    return Response.json({ error: 'Profile not found' }, { status: 404 })
  }

  return Response.json({
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      sector: profile.sector,
      barrio: profile.barrio,
      municipio: profile.municipio,
      companyId: profile.company_id,
    },
  })
}
