// @vitest-environment jsdom
import { type ReactNode, createElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ children, ...props }: { children: ReactNode; href: string }) =>
    createElement('a', props, children),
}))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const fn = (key: string) => (namespace ? `${namespace}.${key}` : key)
    return fn
  },
}))

const mockSignInWithPassword = vi.fn()
vi.mock('@/core/shared/infrastructure/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  }),
}))

const { LoginForm } =
  await import('@/app/[locale]/login/_components/login-form')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<LoginForm />', () => {
  it('shows validation errors for invalid email and short password', async () => {
    const user = userEvent.setup()
    const { container } = render(<LoginForm />)

    const emailInput = screen.getByLabelText(/Login.fields.email.label/i)
    const passwordInput = screen.getByLabelText(/Login.fields.password.label/i)
    await user.type(emailInput, 'nope')
    await user.type(passwordInput, '123')

    expect(emailInput).toHaveValue('nope')
    expect(passwordInput).toHaveValue('123')

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2)
    })
    const alertTexts = screen.getAllByRole('alert').map((el) => el.textContent)
    expect(alertTexts).toContain('Login.errors.invalidEmail')
    expect(alertTexts).toContain('Login.errors.minLength')
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('redirects on successful sign in', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: {}, error: null })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(
      screen.getByLabelText(/Login.fields.email.label/i),
      'hola@example.com',
    )
    await user.type(
      screen.getByLabelText(/Login.fields.password.label/i),
      'Secret123',
    )
    await user.click(screen.getByRole('button', { name: /Login\.cta/ }))

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'hola@example.com',
        password: 'Secret123',
      })
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/app/recomendaciones')
    })
  })

  it('shows i18n credentials error on Supabase invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid login credentials' },
    })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(
      screen.getByLabelText(/Login.fields.email.label/i),
      'hola@example.com',
    )
    await user.type(
      screen.getByLabelText(/Login.fields.password.label/i),
      'Secret123',
    )
    await user.click(screen.getByRole('button', { name: /Login\.cta/ }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Login.errors.invalidCredentials')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('passes through other Supabase error messages verbatim', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: 'Network unreachable' },
    })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(
      screen.getByLabelText(/Login.fields.email.label/i),
      'hola@example.com',
    )
    await user.type(
      screen.getByLabelText(/Login.fields.password.label/i),
      'Secret123',
    )
    await user.click(screen.getByRole('button', { name: /Login\.cta/ }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Network unreachable')
    expect(mockPush).not.toHaveBeenCalled()
  })
})
