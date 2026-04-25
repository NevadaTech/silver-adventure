import { describe, it, expect } from 'vitest'

import { ValueObject } from '@/core/shared/domain/ValueObject'

/**
 * Concrete implementation for testing the abstract base class.
 */
class TestVO extends ValueObject<{ value: string }> {
  constructor(value: string) {
    super({ value })
  }

  get value(): string {
    return this.props.value
  }
}

class OtherVO extends ValueObject<{ value: string }> {
  constructor(value: string) {
    super({ value })
  }
}

describe('ValueObject', () => {
  describe('constructor', () => {
    it('stores props as frozen (immutable)', () => {
      const vo = new TestVO('hello')

      expect(vo.value).toBe('hello')
      // Props are frozen — mutations should throw in strict mode or silently fail
      expect(() => {
        ;(vo as unknown as { props: { value: string } }).props.value = 'changed'
      }).toThrow()
    })
  })

  describe('equals()', () => {
    it('two VOs with same props are equal', () => {
      const a = new TestVO('hello')
      const b = new TestVO('hello')

      expect(a.equals(b)).toBe(true)
    })

    it('two VOs with different props are NOT equal', () => {
      const a = new TestVO('hello')
      const b = new TestVO('world')

      expect(a.equals(b)).toBe(false)
    })

    it('returns false when comparing with a non-ValueObject', () => {
      const vo = new TestVO('hello')
      // Force a non-VO through the type system to test the instanceof branch
      const notAVO = { props: { value: 'hello' } } as unknown as TestVO

      expect(vo.equals(notAVO)).toBe(false)
    })

    it('two different VO subclasses with same props are still equal (structural equality)', () => {
      const a = new TestVO('hello')
      const b = new OtherVO('hello')

      // ValueObject uses JSON.stringify for comparison — structural, not nominal
      expect(a.equals(b)).toBe(true)
    })
  })
})
