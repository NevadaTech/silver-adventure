import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'
import { User } from '@/core/users/domain/entities/User'

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
    // Using signUp instead of admin.createUser to get a session with tokens
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

    // Since we want auto-login, we need to confirm the email
    // Get the user object and use admin API to confirm
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
      // Delete the auth user since confirmation failed
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
      // Delete the auth user since profile creation failed
      await supabase.auth.admin.deleteUser(authData.user.id)
      return Response.json(
        { error: profileError?.message || 'Failed to create user profile' },
        { status: 400 },
      )
    }

    // Create User entity
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
