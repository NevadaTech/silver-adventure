import {
  brainClient,
  BrainHttpError,
  type BrainOnboardRequest,
  type BrainOnboardResponse,
} from '@/core/shared/infrastructure/brain/brainClient'
import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'
import { User } from '@/core/users/domain/entities/User'

const VALID_YEARS = new Set<BrainOnboardRequest['yearsOfOperation']>([
  'menos_1',
  '1_3',
  '3_5',
  '5_10',
  'mas_10',
])

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      businessName,
      sector,
      yearsOfOperation,
      municipio,
      barrio,
      hasChamber,
      nit,
      whatsapp,
      email,
      password,
      descripcion,
    } = body

    // Validate required fields
    if (!businessName || !sector || !email || !password) {
      return Response.json(
        {
          error: 'businessName, sector, email, and password are required',
        },
        { status: 400 },
      )
    }

    if (!municipio || !barrio) {
      return Response.json(
        {
          error: 'municipio and barrio are required',
        },
        { status: 400 },
      )
    }

    if (
      typeof descripcion !== 'string' ||
      descripcion.trim().length < 10 ||
      descripcion.trim().length > 280
    ) {
      return Response.json(
        { error: 'descripcion must be between 10 and 280 characters' },
        { status: 400 },
      )
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate password
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return Response.json(
        {
          error:
            'Password must be at least 8 characters with uppercase, lowercase, and number',
        },
        { status: 400 },
      )
    }

    const supabase = createSupabaseServerClient()

    // Create Supabase auth user (email + password)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined,
      },
    })

    if (authError || !authData.user) {
      serverLogger.error('[POST /api/auth/register] Auth error:', authError)
      return Response.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 },
      )
    }

    // Auto-confirm email so the user gets a session immediately
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      authData.user.id,
      {
        email_confirm: true,
      },
    )

    if (confirmError) {
      serverLogger.error(
        '[POST /api/auth/register] Email confirm error:',
        confirmError,
      )
      await supabase.auth.admin.deleteUser(authData.user.id)
      return Response.json(
        { error: confirmError?.message || 'Failed to confirm email' },
        { status: 400 },
      )
    }

    // Create user profile in public.users table
    const { data, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name: businessName,
        sector,
        years_of_operation: yearsOfOperation || null,
        municipio,
        barrio,
        has_chamber: hasChamber || false,
        nit: nit || null,
        whatsapp: whatsapp || null,
        created_at: new Date().toISOString(),
      })
      .select('id, name, email, created_at')
      .single()

    if (profileError || !data) {
      serverLogger.error(
        '[POST /api/auth/register] Profile error:',
        profileError,
      )
      await supabase.auth.admin.deleteUser(authData.user.id)
      return Response.json(
        { error: profileError?.message || 'Failed to create user profile' },
        { status: 400 },
      )
    }

    const typedData = data as {
      id: string
      name: string
      created_at: string
      email: string
    }
    const user = User.create(
      typedData.id,
      typedData.name,
      new Date(typedData.created_at),
      typedData.email,
    )

    // Classify the business + persist Company + clusters + initial recommendations
    let onboarding: BrainOnboardResponse | null = null
    try {
      const safeYears = VALID_YEARS.has(yearsOfOperation)
        ? (yearsOfOperation as BrainOnboardRequest['yearsOfOperation'])
        : null
      onboarding = await brainClient.post<BrainOnboardResponse>(
        '/api/companies/onboard',
        {
          userId: user.id,
          description: descripcion.trim(),
          businessName,
          municipio,
          yearsOfOperation: safeYears,
          hasChamber: Boolean(hasChamber),
          nit: nit || null,
        } satisfies BrainOnboardRequest,
      )

      const { error: linkError } = await supabase
        .from('users')
        .update({ company_id: onboarding.company.id })
        .eq('id', user.id)
      if (linkError) {
        serverLogger.warn(
          '[POST /api/auth/register] Could not link user→company',
          linkError,
        )
      }
    } catch (brainErr) {
      // Onboarding is best-effort — user already exists; classification can
      // be retried later. We log and surface a warning instead of failing.
      if (brainErr instanceof BrainHttpError) {
        serverLogger.error(
          `[POST /api/auth/register] Brain onboarding failed (${brainErr.status})`,
          brainErr.body,
        )
      } else {
        serverLogger.error(
          '[POST /api/auth/register] Brain onboarding error',
          brainErr,
        )
      }
    }

    return Response.json(
      {
        data: {
          accessToken: authData.session?.access_token || '',
          refreshToken: authData.session?.refresh_token || '',
          user: {
            id: user.id,
            email: user.email,
            createdAt: user.createdAt.toISOString(),
          },
          onboarding,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    serverLogger.error('[POST /api/auth/register]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: message }, { status: 400 })
  }
}
