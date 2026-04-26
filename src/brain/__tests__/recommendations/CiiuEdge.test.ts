import { describe, expect, it } from 'vitest'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'

const validInput = () => ({
  ciiuOrigen: '5511',
  ciiuDestino: '9601',
  hasMatch: true,
  relationType: 'proveedor' as const,
  confidence: 0.85,
  modelVersion: null,
})

describe('CiiuEdge', () => {
  it('creates a valid edge with all fields', () => {
    const edge = CiiuEdge.create(validInput())
    expect(edge.ciiuOrigen).toBe('5511')
    expect(edge.ciiuDestino).toBe('9601')
    expect(edge.hasMatch).toBe(true)
    expect(edge.relationType).toBe('proveedor')
    expect(edge.confidence).toBe(0.85)
    expect(edge.modelVersion).toBeNull()
  })

  it('accepts modelVersion as a string (non-legacy)', () => {
    const edge = CiiuEdge.create({
      ...validInput(),
      modelVersion: 'gemini-2.5-flash',
    })
    expect(edge.modelVersion).toBe('gemini-2.5-flash')
  })

  it('accepts modelVersion: null (legacy)', () => {
    const edge = CiiuEdge.create({ ...validInput(), modelVersion: null })
    expect(edge.modelVersion).toBeNull()
  })

  it('rejects confidence below 0', () => {
    expect(() =>
      CiiuEdge.create({ ...validInput(), confidence: -0.1 }),
    ).toThrow('CiiuEdge.confidence out of [0,1]')
  })

  it('rejects confidence above 1', () => {
    expect(() =>
      CiiuEdge.create({ ...validInput(), confidence: 1.01 }),
    ).toThrow('CiiuEdge.confidence out of [0,1]')
  })

  it('accepts confidence at boundary values 0 and 1', () => {
    expect(() =>
      CiiuEdge.create({ ...validInput(), confidence: 0 }),
    ).not.toThrow()
    expect(() =>
      CiiuEdge.create({ ...validInput(), confidence: 1 }),
    ).not.toThrow()
  })

  it('rejects empty ciiuOrigen', () => {
    expect(() => CiiuEdge.create({ ...validInput(), ciiuOrigen: '' })).toThrow(
      'CiiuEdge.ciiuOrigen empty',
    )
  })

  it('rejects whitespace-only ciiuOrigen', () => {
    expect(() =>
      CiiuEdge.create({ ...validInput(), ciiuOrigen: '   ' }),
    ).toThrow('CiiuEdge.ciiuOrigen empty')
  })

  it('rejects empty ciiuDestino', () => {
    expect(() => CiiuEdge.create({ ...validInput(), ciiuDestino: '' })).toThrow(
      'CiiuEdge.ciiuDestino empty',
    )
  })

  it('rejects hasMatch=true without relationType', () => {
    expect(() =>
      CiiuEdge.create({ ...validInput(), hasMatch: true, relationType: null }),
    ).toThrow('CiiuEdge.hasMatch=true requires relationType')
  })

  it('allows hasMatch=false without relationType', () => {
    expect(() =>
      CiiuEdge.create({
        ...validInput(),
        hasMatch: false,
        relationType: null,
      }),
    ).not.toThrow()
  })

  it('props are frozen (immutable)', () => {
    const edge = CiiuEdge.create(validInput())
    // Accessing internal props indirectly via getters — we verify no mutation is possible
    // by attempting to reassign via casting
    const props = (edge as unknown as { props: Record<string, unknown> }).props
    expect(Object.isFrozen(props)).toBe(true)
  })
})
