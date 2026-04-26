import { describe, expect, it } from 'vitest'
import {
  buildEcosystemClusterId,
  slugLower,
} from '@/clusters/application/services/LabelPropagation'

describe('buildEcosystemClusterId', () => {
  it('produces expected deterministic ID for known inputs', () => {
    // sha1('5511-9601') = 10aa6a0e6a530cdcbe10a23060d45b2bd7b8c3ea
    // first 8 chars: 10aa6a0e
    // slugLower('Santa Marta') = 'santa-marta'
    const id = buildEcosystemClusterId(['5511', '9601'], 'Santa Marta')
    expect(id).toBe('eco-10aa6a0e-santa-marta')
  })

  it('produces same ID regardless of input order (internal sort)', () => {
    const id1 = buildEcosystemClusterId(['5511', '9601'], 'Santa Marta')
    const id2 = buildEcosystemClusterId(['9601', '5511'], 'Santa Marta')
    expect(id1).toBe(id2)
  })

  it('produces different ID when CIIUs are different', () => {
    const id1 = buildEcosystemClusterId(['5511', '9601'], 'Santa Marta')
    const id2 = buildEcosystemClusterId(['5511', '5612'], 'Santa Marta')
    expect(id1).not.toBe(id2)
  })

  it('produces different ID when municipio is different (same CIIUs)', () => {
    const id1 = buildEcosystemClusterId(['5511', '9601'], 'Santa Marta')
    const id2 = buildEcosystemClusterId(['5511', '9601'], 'Barranquilla')
    expect(id1).not.toBe(id2)
    // same hash, different slug
    expect(id1.slice(4, 12)).toBe(id2.slice(4, 12))
  })

  it('generated ID matches the eco-{8hex}-{slug} pattern', () => {
    const id = buildEcosystemClusterId(['5511', '9601'], 'Santa Marta')
    expect(id).toMatch(/^eco-[0-9a-f]{8}-[a-z0-9-]+$/)
  })
})

describe('slugLower', () => {
  it('removes diacritics and lowercases', () => {
    expect(slugLower('Bogotá')).toBe('bogota')
  })

  it('replaces spaces with dashes', () => {
    expect(slugLower('Santa Marta')).toBe('santa-marta')
  })

  it('handles special characters in Bogotá D.C.', () => {
    expect(slugLower('Bogotá D.C.')).toBe('bogota-d.c.')
  })

  it('collapses multiple spaces into a single dash', () => {
    expect(slugLower('San  José')).toBe('san-jose')
  })

  it('lowercases already-ascii strings', () => {
    expect(slugLower('MEDELLIN')).toBe('medellin')
  })
})
