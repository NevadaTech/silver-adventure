import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'
import { RegisterUser } from '@/core/auth/application/use-cases/RegisterUser'
import { SupabaseAuthRepository } from '@/core/auth/infrastructure/repositories/SupabaseAuthRepository'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { email, password, name } = body

    if (!email || !password || !name) {
      return Response.json(
        { error: 'Email, password, and name are required' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseServerClient()
    const repository = new SupabaseAuthRepository(supabase)
    const registerUser = new RegisterUser(repository)

    const { user } = await registerUser.execute({ email, password, name })

    return Response.json(
      {
        data: {
          user: {
            id: user.id,
            name: user.name,
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

    if (message.includes('already')) {
      return Response.json({ error: message }, { status: 400 })
    }

    return Response.json({ error: 'Failed to register user' }, { status: 500 })
  }
}
