import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Componente de prueba — solo para verificar que la setup funciona
function Counter() {
  const [count, setCount] = React.useState(0)
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  )
}

// globals: true en vitest.config → React disponible sin import explícito
// pero para ser explícitos y evitar confusión lo importamos
import React from 'react'

describe('Vitest setup', () => {
  it('renders a component correctly', () => {
    render(<p>Hello Vitest</p>)
    expect(screen.getByText('Hello Vitest')).toBeInTheDocument()
  })

  it('handles user interactions', async () => {
    const user = userEvent.setup()
    render(<Counter />)

    expect(screen.getByText('Count: 0')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Increment' }))

    expect(screen.getByText('Count: 1')).toBeInTheDocument()
  })
})
