// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Recomendacion } from '@/app/[locale]/app/_data/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockApply = vi.fn()
const mockRemove = vi.fn()
vi.mock(
  '@/core/connections/infrastructure/hooks/useRecommendationAction',
  () => ({
    useRecommendationAction: () => ({
      apply: mockApply,
      remove: mockRemove,
      isPending: false,
      error: null,
    }),
  }),
)

const mockIsApplied = vi.fn(() => false)
vi.mock('@/core/connections/infrastructure/hooks/useUserConnections', () => ({
  useUserConnections: () => ({
    data: undefined,
    raw: undefined,
    isLoading: false,
    error: undefined,
    isApplied: mockIsApplied,
  }),
}))

const { RecoDetailDrawer } =
  await import('@/app/[locale]/app/_components/reco-detail-drawer')

const sampleReco: Recomendacion = {
  id: 'rec-1',
  target: {
    id: 'comp-1',
    iniciales: 'PB',
    nombre: 'Pescaderia La Bahia',
    sector: 'CIIU A0312',
    barrio: 'Taganga',
    origen: 'formal',
    avatarColor: 'bg-primary-soft text-primary',
  },
  tipoRelacion: 'proveedor',
  score: 85,
  razon: 'Coinciden en municipio y sector',
  estado: 'nueva',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApply.mockResolvedValue(undefined)
  mockRemove.mockResolvedValue(undefined)
  mockIsApplied.mockImplementation(() => false)
})

describe('<RecoDetailDrawer />', () => {
  it('records a saved action when "guardar" is clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const onClose = vi.fn()

    render(
      <RecoDetailDrawer
        reco={sampleReco}
        onClose={onClose}
        onUpdateEstado={onUpdate}
      />,
    )

    await user.click(screen.getByRole('button', { name: /acciones\.guardar/ }))

    expect(onUpdate).toHaveBeenCalledWith('rec-1', 'guardada')
    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith('rec-1', 'saved')
    })
  })

  it('records a dismissed action when "descartar" is clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(
      <RecoDetailDrawer
        reco={sampleReco}
        onClose={vi.fn()}
        onUpdateEstado={onUpdate}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /acciones\.descartar/ }),
    )

    expect(onUpdate).toHaveBeenCalledWith('rec-1', 'descartada')
    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith('rec-1', 'dismissed')
    })
  })

  it('rolls back the optimistic state when persistence fails', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    mockApply.mockRejectedValueOnce(new Error('boom'))

    render(
      <RecoDetailDrawer
        reco={sampleReco}
        onClose={vi.fn()}
        onUpdateEstado={onUpdate}
      />,
    )

    await user.click(screen.getByRole('button', { name: /acciones\.guardar/ }))

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledTimes(2)
    })
    expect(onUpdate.mock.calls[0]).toEqual(['rec-1', 'guardada'])
    expect(onUpdate.mock.calls[1]).toEqual(['rec-1', 'nueva'])
  })

  it('logs simulated_contact when WhatsApp button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <RecoDetailDrawer
        reco={sampleReco}
        onClose={vi.fn()}
        onUpdateEstado={vi.fn()}
      />,
    )

    const link = screen.getByRole('link', { name: /acciones\.aceptar/ })
    await user.click(link)

    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith('rec-1', 'simulated_contact')
    })
  })
})
