import { RegisterFormWithOtp } from '@/core/auth/infrastructure/components/RegisterFormWithOtp'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow">
        <h1 className="mb-2 text-2xl font-bold">Crear Negocio</h1>
        <p className="mb-6 text-sm text-gray-600">
          Únete a nuestra red de emprendedores y encuentra conexiones
        </p>
        <RegisterFormWithOtp />
      </div>
    </div>
  )
}
