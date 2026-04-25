import axios from 'axios'
import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios'

/**
 * Token provider — función que retorna el token de auth actual.
 *
 * Se configura una vez con `setTokenProvider()`. Si no se configura,
 * el interceptor no agrega Authorization header (modo anónimo).
 *
 * Ejemplo de uso futuro:
 *   setTokenProvider(() => supabase.auth.getSession().then(s => s.data.session?.access_token))
 */
let tokenProvider: (() => Promise<string | null> | string | null) | null = null

export function setTokenProvider(
  provider: () => Promise<string | null> | string | null,
) {
  tokenProvider = provider
}

/**
 * HTTP Client — Axios Instance
 *
 * Instancia singleton de axios con:
 * - Base URL relativa (misma origin — BFF pattern)
 * - Interceptor de request: inyecta Authorization header si hay token
 * - Timeout por defecto: 10s
 * - Content-Type JSON
 *
 * ¿Por qué no fetch nativo? Porque necesitamos interceptors para auth,
 * y eso con fetch requiere un wrapper manual que termina siendo axios casero.
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: '/',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Request interceptor — Authorization header
 *
 * Si hay un tokenProvider configurado y retorna un token,
 * lo agrega al header. Si no, pasa sin auth (endpoints públicos).
 */
httpClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (tokenProvider) {
      const token = await tokenProvider()

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    return config
  },
)

/**
 * Response interceptor — Error normalization
 *
 * Axios ya tira en status >= 400, pero queremos normalizar
 * el mensaje de error usando lo que viene del server.
 */
httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const serverMessage = error.response?.data?.error
    const message =
      serverMessage ?? error.message ?? 'An unexpected error occurred'

    return Promise.reject(new Error(message))
  },
)
