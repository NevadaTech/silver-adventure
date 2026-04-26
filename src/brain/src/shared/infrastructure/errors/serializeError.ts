const POSTGRES_FIELDS = ['code', 'message', 'details', 'hint'] as const

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

const hasPostgresShape = (v: Record<string, unknown>): boolean =>
  typeof v.message === 'string' &&
  ('code' in v || 'details' in v || 'hint' in v)

const safeJson = (v: unknown): string => {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export const serializeError = (e: unknown): string => {
  if (e instanceof Error) return e.message
  if (e === null) return 'null'
  if (e === undefined) return 'undefined'
  if (typeof e === 'string') return e
  if (typeof e !== 'object') return String(e)

  const obj = e as Record<string, unknown>

  if (hasPostgresShape(obj)) {
    const parts: string[] = []
    for (const field of POSTGRES_FIELDS) {
      const value = obj[field]
      if (value === undefined || value === null) continue
      parts.push(`${field}=${String(value)}`)
    }
    return parts.join(' ')
  }

  if (typeof obj.message === 'string') return obj.message

  return safeJson(obj)
}
