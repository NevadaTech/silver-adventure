# 📱 Documentación de Registro con OTP

Guía para conectar la UI de registro con los APIs y hooks backend.

---

## 🎯 Flujo de Registro

```
Usuario llena formulario
        ↓
   [Solicitar OTP]
        ↓
POST /api/auth/request-otp (Mock SMS envia código)
        ↓
Usuario recibe código en WhatsApp
        ↓
[Verificar Código]
        ↓
POST /api/auth/verify-otp (Crea usuario)
        ↓
✅ Registro exitoso
```

---

## 📦 Datos del Formulario

### Campos requeridos

```typescript
interface RegistrationForm {
  // Negocio
  businessName: string // Ej: "Tech Solutions Ltd"
  sector: string // Ej: "TECNOLOGIA" (ver opciones abajo)
  yearsOfOperation: string // Ej: "1-5" (ver opciones abajo)

  // Ubicación
  municipio: string // Ej: "Medellín"
  barrio: string // Ej: "Centro"

  // Cámara de Comercio
  hasChamber: boolean // true/false
  nit?: string // Requerido si hasChamber = true

  // Contacto
  whatsapp: string // Ej: "+573001234567" (OBLIGATORIO)
  email?: string // Opcional

  // Autenticación
  password: string // Mínimo 8 caracteres
}
```

### Opciones de dropdown

**Sector:**

```
- TECNOLOGIA
- LOGISTICA
- TURISMO
- CACAO
- AGRICULTURA
```

**Años de operación:**

```
- <1      (Menos de 1 año)
- 1-5     (1 a 5 años)
- 5-10    (5 a 10 años)
- >10     (Más de 10 años)
```

---

## 🪝 Hook 1: Solicitar OTP

### Importar

```typescript
import { useRegisterWithOtp } from '@/core/auth/infrastructure/hooks/useRegisterWithOtp'
```

### Usar

```typescript
function MiFormulario() {
  const { requestOtp, isLoading, error } = useRegisterWithOtp()

  const handleSubmit = async (formData: RegistrationForm) => {
    // Validar datos antes de enviar
    if (!formData.businessName.trim()) {
      alert('Ingresa nombre del negocio')
      return
    }

    // Solicitar OTP
    const resultado = await requestOtp(formData)

    if (resultado?.sessionId) {
      // ✅ OTP enviado correctamente
      console.log('SessionId:', resultado.sessionId)
      console.log('Mensaje:', resultado.message)

      // GUARDAR sessionId para el siguiente paso
      saveSessionId(resultado.sessionId)

      // Ir a pantalla de verificación
      goToVerificationScreen()
    } else if (error) {
      // ❌ Error en la solicitud
      alert(`Error: ${error.message}`)
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleSubmit(formData)
    }}>
      {/* Tu formulario aquí */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Enviando código...' : 'Solicitar Código OTP'}
      </button>

      {error && <p style={{ color: 'red' }}>{error.message}</p>}
    </form>
  )
}
```

### Estados

- `isLoading`: true mientras se envía la solicitud
- `error`: null si no hay error, Error si hay problema
- Retorna: `{ sessionId: string, message: string }` si es exitoso

---

## 🔐 Hook 2: Verificar OTP

### Importar

```typescript
import { useVerifyOtp } from '@/core/auth/infrastructure/hooks/useVerifyOtp'
```

### Usar

```typescript
function VerificacionOTP() {
  const { verifyOtp, isLoading, error, user } = useVerifyOtp()
  const [codigo, setCodigo] = useState('')
  const sessionId = getSessionId() // Obtener del paso anterior

  const handleVerificar = async () => {
    if (!codigo || codigo.length !== 6) {
      alert('Ingresa un código de 6 dígitos')
      return
    }

    // Verificar OTP
    const resultado = await verifyOtp(sessionId, codigo)

    if (resultado?.user) {
      // ✅ Usuario creado correctamente
      console.log('Usuario creado:', resultado.user)
      console.log('ID:', resultado.user.id)
      console.log('Email:', resultado.user.email)
      console.log('Nombre:', resultado.user.name)

      // Ir a pantalla de éxito
      goToSuccessScreen()

      // Opcional: redirigir a login
      setTimeout(() => {
        window.location.href = '/en/auth/login'
      }, 2000)
    } else if (error) {
      // ❌ Código inválido o expirado
      alert(`Error: ${error.message}`)
      setCodigo('')
    }
  }

  return (
    <div>
      <p>Enviamos un código a tu WhatsApp</p>

      <input
        type="text"
        maxLength={6}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="123456"
      />

      <button onClick={handleVerificar} disabled={isLoading || codigo.length !== 6}>
        {isLoading ? 'Verificando...' : 'Verificar Código'}
      </button>

      {error && <p style={{ color: 'red' }}>{error.message}</p>}
      {user && <p style={{ color: 'green' }}>¡Bienvenido, {user.name}!</p>}
    </div>
  )
}
```

### Estados

- `isLoading`: true mientras se verifica el código
- `error`: null si no hay error, Error si hay problema
- `user`: null hasta que se verifica exitosamente
- Retorna: `{ user: { id, name, email, createdAt } }` si es exitoso

---

## 🔌 Respuestas del API

### POST /api/auth/request-otp

**Éxito (200):**

```json
{
  "data": {
    "sessionId": "a1b2c3d4e5f6g7h8",
    "message": "OTP sent to WhatsApp number"
  }
}
```

**Error (400):**

```json
{
  "error": "Email already registered"
}
```

```json
{
  "error": "Invalid WhatsApp format"
}
```

---

### POST /api/auth/verify-otp

**Éxito (201):**

```json
{
  "data": {
    "user": {
      "id": "user-123abc",
      "name": "Tech Solutions",
      "email": "contact@techsolutions.com",
      "createdAt": "2026-04-25T17:30:00Z"
    }
  }
}
```

**Error (400):**

```json
{
  "error": "Invalid or expired OTP code"
}
```

```json
{
  "error": "Invalid or expired OTP session"
}
```

---

## 🧪 Testing en Desarrollo (Mock SMS)

En desarrollo, el código OTP aparece en la **consola del servidor** (terminal):

```
[MOCK SMS] OTP sent to +573001234567: 316146 (for development only)
```

Copia ese código y úsalo para verificar.

---

## ⚠️ Validaciones Backend

El servidor valida automáticamente:

| Campo            | Validación                                  |
| ---------------- | ------------------------------------------- |
| businessName     | No vacío                                    |
| sector           | No vacío                                    |
| yearsOfOperation | No vacío                                    |
| municipio        | No vacío                                    |
| barrio           | No vacío                                    |
| whatsapp         | Formato: `+57XXXXXXXXXX` (10 dígitos)       |
| email            | Formato válido de email (si se proporciona) |
| password         | Mínimo 8 caracteres                         |
| nit              | Requerido si `hasChamber = true`            |

---

## 📝 Ejemplo Completo (2 Pasos)

```typescript
import { useState } from 'react'
import { useRegisterWithOtp } from '@/core/auth/infrastructure/hooks/useRegisterWithOtp'
import { useVerifyOtp } from '@/core/auth/infrastructure/hooks/useVerifyOtp'

export function RegistrationFlow() {
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [sessionId, setSessionId] = useState('')
  const [formData, setFormData] = useState({
    businessName: '',
    sector: '',
    yearsOfOperation: '',
    municipio: '',
    barrio: '',
    hasChamber: false,
    whatsapp: '',
    email: '',
    password: '',
  })

  const { requestOtp, isLoading: loadingOtp, error: errorOtp } = useRegisterWithOtp()
  const { verifyOtp, isLoading: loadingVerify, error: errorVerify, user } = useVerifyOtp()

  const handleRequestOtp = async () => {
    const result = await requestOtp(formData)
    if (result?.sessionId) {
      setSessionId(result.sessionId)
      setStep('verify')
    }
  }

  const handleVerifyOtp = async (codigo: string) => {
    const result = await verifyOtp(sessionId, codigo)
    if (result?.user) {
      alert(`¡Bienvenido ${result.user.name}!`)
      // Redirigir a login o dashboard
    }
  }

  if (user) {
    return <div>Registro exitoso</div>
  }

  if (step === 'verify') {
    return (
      <div>
        <h2>Verifica tu código OTP</h2>
        <input
          type="text"
          placeholder="Ingresa código"
          maxLength={6}
          onChange={(e) => {
            if (e.target.value.length === 6) {
              handleVerifyOtp(e.target.value)
            }
          }}
        />
        {errorVerify && <p>{errorVerify.message}</p>}
        <button onClick={() => setStep('form')}>Volver</button>
      </div>
    )
  }

  return (
    <div>
      <h2>Crear cuenta</h2>
      <input
        placeholder="Nombre del negocio"
        value={formData.businessName}
        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
      />
      <select
        value={formData.sector}
        onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
      >
        <option value="">Selecciona sector</option>
        <option value="TECNOLOGIA">Tecnología</option>
        <option value="LOGISTICA">Logística</option>
        <option value="TURISMO">Turismo</option>
        <option value="CACAO">Cacao</option>
      </select>
      {/* Más campos... */}
      <button onClick={handleRequestOtp} disabled={loadingOtp}>
        Solicitar OTP
      </button>
      {errorOtp && <p>{errorOtp.message}</p>}
    </div>
  )
}
```

---

## 🚀 Para Producción (Twilio)

Cuando estés listo para producción:

1. Instala Twilio SDK
2. Crea `TwilioSmsAdapter` que implemente `SmsPort`
3. Reemplaza `MockSmsAdapter` por `TwilioSmsAdapter` en Route Handlers
4. **Sin cambios en la lógica de negocio** (polymorphism)

---

¿Preguntas? Contacta al equipo backend.
