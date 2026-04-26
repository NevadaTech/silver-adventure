import { describe, expect, it } from 'vitest'
import {
  RELATION_TYPES,
  type RelationType,
  inverseRelation,
  isRelationType,
} from '@/recommendations/domain/value-objects/RelationType'

describe('RelationType', () => {
  describe('RELATION_TYPES', () => {
    it('lists the four canonical relation types', () => {
      expect(RELATION_TYPES).toEqual([
        'referente',
        'cliente',
        'proveedor',
        'aliado',
      ])
    })
  })

  describe('isRelationType', () => {
    it.each(RELATION_TYPES)('accepts %s', (value) => {
      expect(isRelationType(value)).toBe(true)
    })

    it('rejects unknown values', () => {
      expect(isRelationType('competidor')).toBe(false)
      expect(isRelationType('')).toBe(false)
      expect(isRelationType('REFERENTE')).toBe(false)
    })
  })

  describe('inverseRelation', () => {
    it('swaps cliente <-> proveedor', () => {
      expect(inverseRelation('cliente')).toBe<RelationType>('proveedor')
      expect(inverseRelation('proveedor')).toBe<RelationType>('cliente')
    })

    it('keeps referente symmetric', () => {
      expect(inverseRelation('referente')).toBe<RelationType>('referente')
    })

    it('keeps aliado symmetric', () => {
      expect(inverseRelation('aliado')).toBe<RelationType>('aliado')
    })

    it('is its own inverse for every relation', () => {
      for (const t of RELATION_TYPES) {
        expect(inverseRelation(inverseRelation(t))).toBe(t)
      }
    })
  })
})
