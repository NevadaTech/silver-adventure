'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Link, useRouter } from '@/i18n/navigation'
import { createSupabaseBrowserClient } from '@/core/shared/infrastructure/supabase/client'

import { Field, TextInput } from '../../registro/_components/registro-fields'

type Errors = Partial<Record<'email' | 'password', string>>

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginForm() {
  const t = useTranslations('Login')
  const tErrors = useTranslations('Login.errors')
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function validate(): boolean {
    const next: Errors = {}
    if (!EMAIL_REGEX.test(email.trim())) {
      next.email = 'invalidEmail'
    }
    if (password.length < 6) {
      next.password = 'minLength'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setApiError(null)
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        // Supabase devuelve "Invalid login credentials" para email/password
        // incorrectos. Lo mapeamos a una clave i18n para no acoplar copy a inglés.
        const isCredentialsError = /invalid.*credentials/i.test(error.message)
        setApiError(
          isCredentialsError ? tErrors('invalidCredentials') : error.message,
        )
        return
      }
      router.push('/app/recomendaciones')
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border-border-soft animate-fade-up flex w-full max-w-md flex-col gap-5 rounded-3xl border p-8 shadow-lg shadow-black/5 sm:p-10"
    >
      <header className="text-center">
        <span className="text-secondary text-xs font-bold tracking-wider uppercase">
          {t('eyebrow')}
        </span>
        <h1 className="font-display text-text mt-2 text-3xl font-extrabold tracking-tight">
          {t('title')}
        </h1>
        <p className="text-text-secondary mt-2 text-sm">{t('subtitle')}</p>
      </header>

      <Field
        label={t('fields.email.label')}
        error={errors.email ? tErrors(errors.email) : undefined}
        required
      >
        {(id, hasError) => (
          <div className="relative">
            <Mail className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <TextInput
              id={id}
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('fields.email.placeholder')}
              hasError={hasError}
              autoComplete="email"
              className="pl-10"
            />
          </div>
        )}
      </Field>

      <Field
        label={t('fields.password.label')}
        error={errors.password ? tErrors(errors.password) : undefined}
        required
      >
        {(id, hasError) => (
          <div className="relative">
            <Lock className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <TextInput
              id={id}
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('fields.password.placeholder')}
              hasError={hasError}
              autoComplete="current-password"
              className="pl-10"
            />
          </div>
        )}
      </Field>

      {apiError ? (
        <div
          role="alert"
          className="bg-error/10 text-error rounded-lg border border-red-200 p-3 text-sm"
        >
          {apiError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="bg-primary text-primary-text hover:bg-primary-hover mt-2 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-6 font-semibold shadow-lg shadow-black/5 transition-all hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('sending')}
          </>
        ) : (
          <>
            {t('cta')}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-text-secondary text-center text-sm">
        {t('registerCta')}{' '}
        <Link
          href="/registro"
          className="text-secondary hover:text-secondary-hover font-semibold transition-colors"
        >
          {t('registerLink')}
        </Link>
      </p>
    </form>
  )
}
