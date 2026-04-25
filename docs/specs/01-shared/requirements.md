# 01 — Shared Infrastructure · Requirements

> Infraestructura compartida por todos los bounded contexts del `brain`.
> Aplica `ARQ-001` (hexagonal), `ARQ-008` (env), `ARQ-009` (logger).

---

## Metadata de implementación

| Campo                | Valor                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| **Orden**            | **Phase 1** (después de Phase 0: deps + env + schema)                        |
| **Owner**            | 🟡 **PAIR** (los dos devs juntos o pingponean tasks)                         |
| **Depende de**       | Phase 0 (deps + env vars + schema SQL aplicado)                              |
| **Prerrequisito de** | TODOS los bounded contexts (02, 03, 04, 05, 06)                              |
| **Paralelizable**    | ❌ **NO** — es la fundación, nadie puede arrancar sin esto                   |
| **Bloqueante**       | ✅ **SÍ** — es el camino crítico                                             |
| **Tasks del plan**   | Task 1.1 → 1.5 (`docs/2026-04-25-brain-clustering-engine-implementation.md`) |
| **Estimación**       | ~1 día de trabajo                                                            |

**Por qué pair work:** Si uno se equivoca en el `SupabaseClient` factory, el `GeminiPort`, o el `env.ts`, el otro tiene que rehacer trabajo en CADA contexto. Las fundaciones se construyen con cuatro ojos.

---

## SHR-REQ-001 — Validación de variables de entorno

**Como** sistema
**Necesito** validar todas las variables de entorno requeridas al startup
**Para** fallar rápido (fail-fast) y evitar errores opacos en runtime.

**Criterios:**

- Schema Zod en `src/brain/src/shared/infrastructure/env.ts`.
- Variables requeridas listadas en ARQ-008.
- Si falta una requerida o una tiene tipo inválido → el proceso crashea con error de Zod claro.
- Variables opcionales tienen defaults explícitos.
- El módulo exporta `env` (objeto tipado) — el resto del código NUNCA usa `process.env.X` directamente.

---

## SHR-REQ-002 — Logger como port

**Como** desarrollador
**Necesito** un `Logger` port abstracto con dos adapters
**Para** poder silenciar logs en tests y producción sin cambiar el código consumidor.

**Criterios:**

- Port `Logger` en `shared/domain/Logger.ts` con métodos: `debug | info | warn | error`.
- Adapter `ConsoleLogger` en `shared/infrastructure/logger/ConsoleLogger.ts` — delega a `console.*` con prefijo de nivel.
- Adapter `NullLogger` en `shared/infrastructure/logger/NullLogger.ts` — Null Object, no hace nada.
- Factory `createLogger()` retorna uno u otro según `env.DEBUG_ENABLED`.
- ESLint `no-console: error` global — excepción solo dentro de `ConsoleLogger`.

---

## SHR-REQ-003 — Cliente Supabase

**Como** sistema
**Necesito** un único cliente Supabase configurado con `service_role`
**Para** que los adapters de cada contexto compartan la conexión.

**Criterios:**

- Factory en `shared/infrastructure/supabase/SupabaseClient.ts`.
- Token de inyección NestJS: `SUPABASE_CLIENT`.
- Lee `env.SUPABASE_URL` y `env.SUPABASE_SERVICE_ROLE_KEY`.
- Tipos generados por `bun supabase:types` viven en `shared/infrastructure/supabase/database.types.ts` (auto-generado, excluido de coverage).
- Cliente expuesto vía `SharedModule`.

---

## SHR-REQ-004 — Port y adapter de Gemini

**Como** sistema
**Necesito** un `GeminiPort` con dos métodos básicos
**Para** abstraer al motor de recommendations del SDK específico.

**Criterios:**

- Port `GeminiPort` en `shared/domain/GeminiPort.ts`:
  - `generateText(prompt: string): Promise<string>`
  - `inferStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T>`
- Adapter real `GeminiAdapter` en `shared/infrastructure/gemini/GeminiAdapter.ts` — usa `@google/generative-ai`.
- Adapter de tests `StubGeminiAdapter` con respuestas mockeables.
- Configurable: modelo de chat (`env.GEMINI_CHAT_MODEL`), temperatura, max tokens.

---

## SHR-REQ-005 — Loader de CSV

**Como** sistema
**Necesito** parsear archivos CSV con headers en un solo lugar
**Para** que los seeds y `CsvCompanySource` no dupliquen lógica de parseo.

**Criterios:**

- Servicio `CsvLoader` en `shared/infrastructure/csv/CsvLoader.ts`.
- Usa `papaparse` con `header: true`.
- Método: `load<T>(absolutePath: string): Promise<T[]>`.
- Errores de parseo se loggean vía `Logger` y skippean filas inválidas (no abortan el proceso).

---

## SHR-REQ-006 — Resolución de paths a CSVs

**Como** sistema
**Necesito** una resolución robusta de paths a los CSVs del reto
**Para** que los seeds funcionen sin asumir el `cwd`.

**Criterios:**

- Utility `DataPaths` en `shared/infrastructure/path/DataPaths.ts`.
- Constantes estáticas: `companiesCsv`, `clustersCsv`, `clusterActivitiesCsv`, `clusterSectoresCsv`, `ciiuDianCsv`.
- Cada path usa `path.resolve(__dirname, ...)` o `import.meta.url` — NUNCA `process.cwd()`.
- Tests verifican que cada CSV existe en disco.

---

## SHR-REQ-007 — Módulo NestJS compartido

**Como** sistema
**Necesito** un `SharedModule` que exporte todos los providers compartidos
**Para** que cada bounded context lo importe en su propio module.

**Criterios:**

- `shared.module.ts` con `@Module({ providers: [...], exports: [...] })`.
- Providers exportados: `SUPABASE_CLIENT`, `Logger`, `GeminiPort`, `CsvLoader`, `DataPaths`.
- Decorado con `@Global()` para evitar repetir imports en todos los contextos.

---

## SHR-REQ-008 — Cliente HTTP base (futuro: integración Laravel)

**Como** sistema
**Necesito** un cliente HTTP singleton con interceptors
**Para** integraciones futuras con el backend Laravel del reto vía API REST.

**Criterios:**

- **Status:** opcional para MVP del hackathon. Solo construir si se llega.
- Si se construye: axios con `baseURL` configurable, interceptor de auth (Bearer token), normalización de errores.
- Vive en `shared/infrastructure/http/httpClient.ts`.
