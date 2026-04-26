import { describe, expect, it } from 'vitest'
import {
  AiMatchCacheEntry,
  type CreateAiMatchCacheEntryInput,
} from '@/recommendations/domain/entities/AiMatchCacheEntry'

const validInput = (
  overrides: Partial<CreateAiMatchCacheEntryInput> = {},
): CreateAiMatchCacheEntryInput => ({
  ciiuOrigen: '0122',
  ciiuDestino: '4631',
  hasMatch: true,
  relationType: 'cliente',
  confidence: 0.85,
  reason: 'Banano hacia mayoristas',
  ...overrides,
})

describe('AiMatchCacheEntry', () => {
  it('creates a positive match entry with all fields', () => {
    const entry = AiMatchCacheEntry.create(validInput())

    expect(entry.ciiuOrigen).toBe('0122')
    expect(entry.ciiuDestino).toBe('4631')
    expect(entry.hasMatch).toBe(true)
    expect(entry.relationType).toBe('cliente')
    expect(entry.confidence).toBe(0.85)
    expect(entry.reason).toBe('Banano hacia mayoristas')
    expect(entry.cachedAt).toBeInstanceOf(Date)
  })

  it('creates a negative match entry without relationType', () => {
    const entry = AiMatchCacheEntry.create(
      validInput({
        hasMatch: false,
        relationType: null,
        confidence: null,
        reason: null,
      }),
    )

    expect(entry.hasMatch).toBe(false)
    expect(entry.relationType).toBeNull()
    expect(entry.confidence).toBeNull()
    expect(entry.reason).toBeNull()
  })

  it('uses provided cachedAt when given', () => {
    const at = new Date('2026-04-25T12:00:00Z')
    const entry = AiMatchCacheEntry.create(validInput({ cachedAt: at }))
    expect(entry.cachedAt).toEqual(at)
  })

  it('rejects empty ciiuOrigen and ciiuDestino', () => {
    expect(() =>
      AiMatchCacheEntry.create(validInput({ ciiuOrigen: '' })),
    ).toThrow('AiMatchCacheEntry.ciiuOrigen cannot be empty')
    expect(() =>
      AiMatchCacheEntry.create(validInput({ ciiuDestino: '   ' })),
    ).toThrow('AiMatchCacheEntry.ciiuDestino cannot be empty')
  })

  it('rejects positive matches without a relationType', () => {
    expect(() =>
      AiMatchCacheEntry.create(
        validInput({ hasMatch: true, relationType: null }),
      ),
    ).toThrow('AiMatchCacheEntry with hasMatch=true requires a relationType')
  })

  it('rejects confidence outside 0..1', () => {
    expect(() =>
      AiMatchCacheEntry.create(validInput({ confidence: -0.1 })),
    ).toThrow('AiMatchCacheEntry.confidence must be between 0 and 1')
    expect(() =>
      AiMatchCacheEntry.create(validInput({ confidence: 1.2 })),
    ).toThrow('AiMatchCacheEntry.confidence must be between 0 and 1')
  })

  it('exposes a stable composite key', () => {
    const entry = AiMatchCacheEntry.create(validInput())
    expect(entry.key).toBe('0122->4631')
  })

  it('accepts modelVersion as a non-null string', () => {
    const entry = AiMatchCacheEntry.create(
      validInput({ modelVersion: 'gemini-2.5-flash' }),
    )
    expect(entry.modelVersion).toBe('gemini-2.5-flash')
  })

  it('accepts modelVersion: null (legacy entry)', () => {
    const entry = AiMatchCacheEntry.create(validInput({ modelVersion: null }))
    expect(entry.modelVersion).toBeNull()
  })

  it('defaults modelVersion to null when not provided', () => {
    const entry = AiMatchCacheEntry.create(validInput())
    expect(entry.modelVersion).toBeNull()
  })
})
