// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { Imagotipo } from '@/core/shared/infrastructure/brand/Imagotipo'

describe('Imagotipo', () => {
  it('renders an accessible SVG with the default title', () => {
    render(<Imagotipo />)

    const svg = screen.getByRole('img', { name: 'Ruta C Conecta' })

    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 630.4 257.44')
  })

  it('uses a custom title when provided', () => {
    render(<Imagotipo title="Logo principal" />)

    expect(
      screen.getByRole('img', { name: 'Logo principal' }),
    ).toBeInTheDocument()
  })

  it('forwards className to the root <svg>', () => {
    render(<Imagotipo className="text-primary h-8 w-auto" />)

    const svg = screen.getByRole('img', { name: 'Ruta C Conecta' })

    expect(svg).toHaveClass('text-primary', 'h-8', 'w-auto')
  })

  it('paints all paths with currentColor so consumers can recolor via CSS', () => {
    const { container } = render(<Imagotipo />)
    const paths = container.querySelectorAll('path')

    expect(paths.length).toBeGreaterThan(0)
    paths.forEach((path) => {
      expect(path.getAttribute('fill')).toBe('currentColor')
    })
  })
})
