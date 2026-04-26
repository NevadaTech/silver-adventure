'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = {
  sessionId: string
  whatsapp: string
  onSuccess: (tokens: { accessToken: string; refreshToken: string }) => void
  onResend?: () => void
}

export function RegistroStepOtp({
  sessionId,
  whatsapp,
  onSuccess,
  onResend,
}: Props) {
  const t = useTranslations('Landing.Registro.Otp')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError('Código debe tener 6 dígitos')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Error al verificar código')
        return
      }

      const { data: result } = await response.json()
      onSuccess({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    try {
      if (onResend) {
        await onResend()
      }
      setCode('')
      setError(null)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="animate-fade-up flex flex-col gap-5">
      <header className="mb-2">
        <span className="text-secondary text-xs font-bold tracking-wider uppercase">
          {t('eyebrow')}
        </span>
        <h2 className="font-display text-text mt-1 text-2xl font-bold sm:text-3xl">
          {t('title')}
        </h2>
        <p className="text-text-secondary mt-2 text-sm">
          {t('subtitle', { whatsapp })}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="otp-code"
            className="text-text block text-sm font-semibold"
          >
            {t('label')}
          </label>
          <input
            id="otp-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '')
              setCode(val)
              if (val.length === 6) {
                setError(null)
              }
            }}
            placeholder="000000"
            className="border-input bg-background text-text placeholder-text-secondary focus-visible:ring-primary mt-2 block w-full rounded-lg border px-3 py-2 text-center text-2xl tracking-widest focus-visible:ring-2 focus-visible:outline-none"
          />
          {error && <p className="text-error mt-1 text-sm">{error}</p>}
        </div>

        <button
          onClick={handleVerify}
          disabled={isLoading || code.length !== 6}
          className="bg-primary text-background hover:bg-primary-dark disabled:bg-secondary inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verificando...' : t('verify')}
        </button>

        <button
          onClick={handleResend}
          disabled={isResending}
          className="text-primary hover:text-primary-dark underline transition-colors disabled:cursor-not-allowed"
        >
          {isResending ? 'Reenviando...' : t('resend')}
        </button>
      </div>
    </div>
  )
}
