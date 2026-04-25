import { httpClient } from '@/core/shared/infrastructure/http/httpClient'

/**
 * Global Fetcher — SWR + Axios
 *
 * Fetcher por defecto para todos los hooks de SWR.
 * Usa la instancia de axios (que tiene interceptors de auth y error handling).
 *
 * Soporta AbortController: SWR pasa un signal cuando el componente
 * se desmonta o la key cambia, cancelando requests en vuelo.
 * Esto previene memory leaks y race conditions.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const controller = new AbortController()

  const res = await httpClient.get<T>(url, {
    signal: controller.signal,
  })

  return res.data
}
