// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { CurrentUser } from '@/app/[locale]/app/_data/types'

const mockPush = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockSignOut = vi.fn()
vi.mock('@/core/shared/infrastructure/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}))

const mockMutate = vi.fn().mockResolvedValue(undefined)
vi.mock('swr', async () => {
  const actual: object = await vi.importActual('swr')
  return {
    ...actual,
    useSWRConfig: () => ({ mutate: mockMutate }),
  }
})

const { UserMenu } = await import('@/app/[locale]/app/_components/user-menu')

const sampleUser: CurrentUser = {
  id: 'u-1',
  nombre: 'Hotel Brisas Marinas',
  iniciales: 'HB',
  empresa: 'Hotel Brisas Marinas',
  sector: 'turismo',
  barrio: 'Rodadero',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSignOut.mockResolvedValue({ error: null })
})

describe('<UserMenu />', () => {
  it('opens the menu and signs the user out', async () => {
    const user = userEvent.setup()
    render(<UserMenu currentUser={sampleUser} />)

    await user.click(screen.getByRole('button', { expanded: false }))
    await user.click(screen.getByRole('menuitem', { name: /logout/ }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows the user initials and name', () => {
    render(<UserMenu currentUser={sampleUser} />)
    expect(screen.getByText('HB')).toBeInTheDocument()
    expect(screen.getByText('Hotel Brisas Marinas')).toBeInTheDocument()
  })
})
