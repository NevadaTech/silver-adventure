import { describe, it, expect } from 'vitest'
import { ValueObject } from '@/shared/domain/ValueObject'

class Email extends ValueObject<{ value: string }> {
  constructor(value: string) {
    super({ value })
  }
  get value(): string {
    return this.props.value
  }
}

describe('ValueObject', () => {
  it('considers two value objects equal when their props match', () => {
    const a = new Email('foo@bar.com')
    const b = new Email('foo@bar.com')
    expect(a.equals(b)).toBe(true)
  })

  it('considers two value objects different when props differ', () => {
    const a = new Email('foo@bar.com')
    const b = new Email('baz@qux.com')
    expect(a.equals(b)).toBe(false)
  })

  it('freezes props to enforce immutability', () => {
    const email = new Email('foo@bar.com')
    expect(() => {
      // @ts-expect-error — testing runtime immutability
      email.props.value = 'mutated'
    }).toThrow()
  })
})
