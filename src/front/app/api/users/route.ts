import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'
import { GetUsers } from '@/core/users/application/use-cases/GetUsers'
import { SupabaseUserRepository } from '@/core/users/infrastructure/repositories/SupabaseUserRepository'

/**
 * GET /api/users
 *
 * Route Handler que expone los usuarios via REST.
 * La composición hexagonal pasa acá: instanciamos adapter → inyectamos al use case.
 *
 * Nota: la doc de Next.js 16 dice "fetch data in Server Components directly,
 * not via Route Handlers". Pero un Route Handler tiene sentido cuando necesitás
 * exponer una API para clientes externos, móviles, o para consumir desde
 * Client Components con fetch.
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const repository = new SupabaseUserRepository(supabase)
    const getUsers = new GetUsers(repository)

    const { users } = await getUsers.execute()

    return Response.json({
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    serverLogger.error('[GET /api/users]', error)

    return Response.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
