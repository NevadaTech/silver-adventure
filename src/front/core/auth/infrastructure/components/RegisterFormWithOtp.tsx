'use client'

import { useState } from 'react'
import { useRegisterWithOtp } from '@/core/auth/infrastructure/hooks/useRegisterWithOtp'
import { useVerifyOtp } from '@/core/auth/infrastructure/hooks/useVerifyOtp'

type Step = 'form' | 'verify' | 'success'

export function RegisterFormWithOtp() {
  const [step, setStep] = useState<Step>('form')
  const [sessionId, setSessionId] = useState<string>('')
  const [formData, setFormData] = useState({
    businessName: '',
    sector: '',
    yearsOfOperation: '',
    municipio: '',
    barrio: '',
    hasChamber: false,
    nit: '',
    whatsapp: '',
    email: '',
    password: '',
  })
  const [otpCode, setOtpCode] = useState('')

  const {
    requestOtp,
    isLoading: isLoadingOtp,
    error: errorOtp,
  } = useRegisterWithOtp()
  const {
    verifyOtp,
    isLoading: isLoadingVerify,
    error: errorVerify,
    user,
  } = useVerifyOtp()

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await requestOtp(formData)
    if (result?.sessionId) {
      setSessionId(result.sessionId)
      setStep('verify')
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await verifyOtp(sessionId, otpCode)
    if (result?.user) {
      setStep('success')
    }
  }

  if (step === 'success' && user) {
    return (
      <div className="space-y-4">
        <div className="rounded bg-green-50 p-4 text-green-700">
          <h2 className="mb-2 font-bold">¡Registro exitoso!</h2>
          <p>Bienvenido, {user.name}.</p>
          <p className="text-sm">Puedes iniciar sesión ahora.</p>
        </div>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        <div>
          <p className="mb-4 text-sm text-gray-600">
            Enviamos un código OTP a <strong>{formData.whatsapp}</strong>
          </p>
          <label htmlFor="code" className="block text-sm font-medium">
            Código OTP
          </label>
          <input
            type="text"
            id="code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest"
          />
        </div>

        {errorVerify && (
          <div className="rounded bg-red-50 p-3 text-red-700">
            {errorVerify.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoadingVerify || otpCode.length !== 6}
          className="w-full rounded bg-green-600 px-4 py-2 text-white disabled:bg-gray-400"
        >
          {isLoadingVerify ? 'Verificando...' : 'Verificar Código'}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep('form')
            setOtpCode('')
          }}
          className="w-full rounded border border-gray-300 px-4 py-2 text-gray-700"
        >
          Volver
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleRequestOtp} className="space-y-4">
      <div>
        <label htmlFor="businessName" className="block text-sm font-medium">
          Nombre del Negocio
        </label>
        <input
          type="text"
          id="businessName"
          name="businessName"
          value={formData.businessName}
          onChange={handleInputChange}
          required
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="sector" className="block text-sm font-medium">
          Sector Económico
        </label>
        <select
          id="sector"
          name="sector"
          value={formData.sector}
          onChange={handleInputChange}
          required
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="">Selecciona un sector</option>
          <option value="TECNOLOGIA">Tecnología</option>
          <option value="LOGISTICA">Logística</option>
          <option value="TURISMO">Turismo</option>
          <option value="CACAO">Cacao</option>
          <option value="AGRICULTURA">Agricultura</option>
        </select>
      </div>

      <div>
        <label htmlFor="yearsOfOperation" className="block text-sm font-medium">
          Tiempo de Operación
        </label>
        <select
          id="yearsOfOperation"
          name="yearsOfOperation"
          value={formData.yearsOfOperation}
          onChange={handleInputChange}
          required
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="">Selecciona un rango</option>
          <option value="<1">&lt;1 año</option>
          <option value="1-5">1 a 5 años</option>
          <option value="5-10">5 a 10 años</option>
          <option value=">10">&gt;10 años</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="municipio" className="block text-sm font-medium">
            Municipio
          </label>
          <input
            type="text"
            id="municipio"
            name="municipio"
            value={formData.municipio}
            onChange={handleInputChange}
            placeholder="Medellín"
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="barrio" className="block text-sm font-medium">
            Barrio
          </label>
          <input
            type="text"
            id="barrio"
            name="barrio"
            value={formData.barrio}
            onChange={handleInputChange}
            placeholder="Centro"
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="hasChamber"
          name="hasChamber"
          checked={formData.hasChamber}
          onChange={handleInputChange}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="hasChamber" className="text-sm">
          Tengo Cámara de Comercio
        </label>
      </div>

      {formData.hasChamber && (
        <div>
          <label htmlFor="nit" className="block text-sm font-medium">
            NIT
          </label>
          <input
            type="text"
            id="nit"
            name="nit"
            value={formData.nit}
            onChange={handleInputChange}
            placeholder="123456789"
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
      )}

      <div>
        <label htmlFor="whatsapp" className="block text-sm font-medium">
          WhatsApp (Obligatorio)
        </label>
        <input
          type="tel"
          id="whatsapp"
          name="whatsapp"
          value={formData.whatsapp}
          onChange={handleInputChange}
          placeholder="+573001234567"
          required
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-gray-500">
          Formato: +57 seguido de 10 dígitos
        </p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email (Opcional)
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Contraseña
        </label>
        <input
          type="password"
          id="password"
          name="password"
          value={formData.password}
          onChange={handleInputChange}
          required
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres</p>
      </div>

      {errorOtp && (
        <div className="rounded bg-red-50 p-3 text-red-700">
          {errorOtp.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoadingOtp}
        className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:bg-blue-400"
      >
        {isLoadingOtp ? 'Enviando OTP...' : 'Solicitar Código OTP'}
      </button>
    </form>
  )
}
