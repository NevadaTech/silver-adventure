'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { RegistroDataPartial } from './schema'

type StepErrors = Partial<Record<'password' | 'passwordConfirm', string>>

type Props = {
  data: RegistroDataPartial
  errors: StepErrors
  onChange: (patch: RegistroDataPartial) => void
}

export function RegistroStepPassword({ data, errors, onChange }: Props) {
  const t = useTranslations('Landing.Registro.Password')
  const tErrors = useTranslations('Landing.Registro.Errors')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const password = data.password || ''
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasLength = password.length >= 8

  return (
    <div className="animate-fade-up flex flex-col gap-5">
      <header className="mb-2">
        <span className="text-secondary text-xs font-bold tracking-wider uppercase">
          {t('eyebrow')}
        </span>
        <h2 className="font-display text-text mt-1 text-2xl font-bold sm:text-3xl">
          {t('title')}
        </h2>
        <p className="text-text-secondary mt-2 text-sm">{t('subtitle')}</p>
      </header>

      <div className="space-y-4">
        {/* Password field */}
        <div>
          <label
            htmlFor="password"
            className="text-text mb-2 block text-sm font-semibold"
          >
            {t('passwordLabel')}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => onChange({ password: e.target.value })}
              className="border-border-soft focus:border-primary focus:ring-primary/20 bg-surface text-text w-full rounded-lg border px-4 py-3 pr-12 focus:ring-2 focus:outline-none"
              placeholder={t('passwordPlaceholder')}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-text-secondary hover:text-text absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              aria-label={
                showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-error mt-2 text-sm">
              {tErrors(errors.password)}
            </p>
          )}
        </div>

        {/* Password strength indicator */}
        <div className="space-y-2">
          <div className="text-text-secondary text-xs font-semibold uppercase">
            {t('passwordRequirements')}
          </div>
          <div className="space-y-1.5">
            <PasswordRequirement
              met={hasLength}
              label={t('requirement8Plus')}
            />
            <PasswordRequirement
              met={hasUppercase}
              label={t('requirementUppercase')}
            />
            <PasswordRequirement
              met={hasLowercase}
              label={t('requirementLowercase')}
            />
            <PasswordRequirement
              met={hasNumber}
              label={t('requirementNumber')}
            />
          </div>
        </div>

        {/* Confirm password field */}
        <div>
          <label
            htmlFor="passwordConfirm"
            className="text-text mb-2 block text-sm font-semibold"
          >
            {t('passwordConfirmLabel')}
          </label>
          <div className="relative">
            <input
              id="passwordConfirm"
              type={showConfirm ? 'text' : 'password'}
              value={data.passwordConfirm || ''}
              onChange={(e) => onChange({ passwordConfirm: e.target.value })}
              className="border-border-soft focus:border-primary focus:ring-primary/20 bg-surface text-text w-full rounded-lg border px-4 py-3 pr-12 focus:ring-2 focus:outline-none"
              placeholder={t('passwordConfirmPlaceholder')}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="text-text-secondary hover:text-text absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              aria-label={
                showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
            >
              {showConfirm ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.passwordConfirm && (
            <p className="text-error mt-2 text-sm">
              {tErrors(errors.passwordConfirm)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-4 w-4 rounded ${
          met ? 'bg-success' : 'bg-border-soft'
        } transition-colors`}
      />
      <span className={`text-sm ${met ? 'text-text' : 'text-text-secondary'}`}>
        {label}
      </span>
    </div>
  )
}
