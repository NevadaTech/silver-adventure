// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { Cluster } from '@/app/[locale]/app/_data/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}))

const mockUseMiCluster = vi.fn()
vi.mock('@/core/clusters/infrastructure/hooks/useMiCluster', () => ({
  useMiCluster: () => mockUseMiCluster(),
}))

const { MiClusterContent } =
  await import('@/app/[locale]/app/_components/mi-cluster-content')

const sampleCluster: Cluster = {
  id: 'pred-8',
  etiqueta: 'Turismo',
  etapa: 'Cluster estratégico',
  size: 155,
  conexionesActivas: 4,
  centroide: ['Turismo', 'Cluster estratégico de la Cámara', '155 empresas'],
  miembros: [
    {
      actor: {
        id: 'self',
        iniciales: 'YO',
        nombre: 'Yo',
        sector: 'CIIU I5611',
        barrio: 'SANTA MARTA',
        origen: 'formal',
        avatarColor: 'bg-primary text-primary-text',
      },
      flag: 'self',
      score: 95,
    },
    {
      actor: {
        id: 'b',
        iniciales: 'PE',
        nombre: 'Pescadería La Bahía',
        sector: 'CIIU I5611',
        barrio: 'TAGANGA',
        origen: 'formal',
        avatarColor: 'bg-secondary-soft text-secondary-hover',
      },
      flag: 'not_connected',
      score: 84,
    },
  ],
  cadenasDeValor: [
    {
      tipo: 'proveedor',
      etiqueta: 'Proveedores potenciales · Pescadería',
      count: 1,
      topIniciales: ['PE'],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<MiClusterContent />', () => {
  it('renders the loading skeleton while fetching the first cluster', () => {
    mockUseMiCluster.mockReturnValue({
      cluster: undefined,
      raw: undefined,
      isLoading: true,
      error: undefined,
      reason: null,
    })

    const { container } = render(<MiClusterContent />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders the empty state when the user has no company yet', () => {
    mockUseMiCluster.mockReturnValue({
      cluster: undefined,
      raw: undefined,
      isLoading: false,
      error: undefined,
      reason: 'no_company',
    })

    render(<MiClusterContent />)
    expect(screen.getByText('empty.noCompanyDescription')).toBeInTheDocument()
  })

  it('renders the empty state when the company has no cluster yet', () => {
    mockUseMiCluster.mockReturnValue({
      cluster: undefined,
      raw: undefined,
      isLoading: false,
      error: undefined,
      reason: 'no_cluster',
    })

    render(<MiClusterContent />)
    expect(screen.getByText('empty.description')).toBeInTheDocument()
  })

  it('renders the error state when the BFF fails', () => {
    mockUseMiCluster.mockReturnValue({
      cluster: undefined,
      raw: undefined,
      isLoading: false,
      error: new Error('boom'),
      reason: null,
    })

    render(<MiClusterContent />)
    expect(screen.getByText('errorState.title')).toBeInTheDocument()
  })

  it('renders the cluster summary, members list and value chains when data is loaded', () => {
    mockUseMiCluster.mockReturnValue({
      cluster: sampleCluster,
      raw: undefined,
      isLoading: false,
      error: undefined,
      reason: null,
    })

    render(<MiClusterContent />)

    // The cluster name shows up as the page title AND as a centroide trait,
    // so we expect at least one match.
    expect(screen.getAllByText('Turismo').length).toBeGreaterThan(0)
    expect(screen.getByText('Pescadería La Bahía')).toBeInTheDocument()
  })
})
