# 01 — Shared Infrastructure · Scenarios

> Scenarios en formato Given/When/Then para validar `requirements.md`.

---

## SHR-SCN-001 — Env validation crashea si falta SUPABASE_URL

**Given** el archivo `.env` no contiene `SUPABASE_URL`
**When** el proceso del brain arranca (`bun --filter brain start:dev`)
**Then** crashea con un error de Zod indicando que `SUPABASE_URL` es requerida y no debe estar vacía.

---

## SHR-SCN-002 — Env validation crashea si SUPABASE_URL no es URL válida

**Given** el archivo `.env` contiene `SUPABASE_URL=not-a-url`
**When** el proceso del brain arranca
**Then** crashea con un error de Zod: `"SUPABASE_URL must be a valid URL"`.

---

## SHR-SCN-003 — Logger silencia debug cuando DEBUG_ENABLED=false

**Given** `env.DEBUG_ENABLED` es `'false'`
**And** `createLogger()` ha sido invocado y retornó un `Logger`
**When** se llama `logger.debug('mensaje')`
**Then** no se imprime nada en stdout/stderr.

---

## SHR-SCN-004 — Logger imprime debug cuando DEBUG_ENABLED=true

**Given** `env.DEBUG_ENABLED` es `'true'`
**And** `createLogger()` retornó un `ConsoleLogger`
**When** se llama `logger.debug('mensaje')`
**Then** se imprime en stdout con prefijo `[DEBUG]`.

---

## SHR-SCN-005 — SupabaseClient inyecta el cliente configurado

**Given** `env.SUPABASE_URL` y `env.SUPABASE_SERVICE_ROLE_KEY` están definidas
**When** un módulo importa `SharedModule` e inyecta `SUPABASE_CLIENT`
**Then** recibe una instancia de `SupabaseClient` autenticada con `service_role`.

---

## SHR-SCN-006 — GeminiAdapter llama al modelo configurado

**Given** `env.GEMINI_CHAT_MODEL` es `'gemini-2.5-flash'`
**And** una instancia de `GeminiAdapter`
**When** se invoca `adapter.generateText('Hola')`
**Then** se llama internamente al SDK `@google/generative-ai` con el modelo `gemini-2.5-flash` y se retorna la respuesta como string.

---

## SHR-SCN-007 — StubGeminiAdapter retorna respuestas predefinidas

**Given** una instancia de `StubGeminiAdapter` configurada con `{ generateText: () => 'mocked response' }`
**When** se invoca `stub.generateText('cualquier prompt')`
**Then** retorna `'mocked response'` sin llamar al SDK real.

---

## SHR-SCN-008 — CsvLoader parsea headers y retorna objetos tipados

**Given** un archivo CSV con headers `id,name,age` y dos filas de datos
**When** se invoca `csvLoader.load<{id: string; name: string; age: string}>(path)`
**Then** retorna un array de 2 objetos con las claves `id`, `name`, `age`.

---

## SHR-SCN-009 — CsvLoader skippea filas malformadas sin abortar

**Given** un archivo CSV con 3 filas, una de ellas corrupta
**When** se invoca `csvLoader.load(path)`
**Then** retorna 2 objetos válidos
**And** loggea un warning vía `Logger.warn` indicando la fila skippeada.

---

## SHR-SCN-010 — DataPaths resuelve rutas absolutas independientes del cwd

**Given** el proceso corre desde cualquier directorio (`cwd = /tmp` o `cwd = /home/user/repo`)
**When** se accede a `DataPaths.companiesCsv`
**Then** retorna una ruta absoluta a `docs/hackathon/DATA/REGISTRADOS_SII.csv`
**And** `fs.existsSync(DataPaths.companiesCsv)` retorna `true`.

---

## SHR-SCN-011 — SharedModule expone los providers globalmente

**Given** `SharedModule` está decorado con `@Global()` e importado en `AppModule`
**When** un módulo cualquiera (ej. `CompaniesModule`) inyecta `SUPABASE_CLIENT` sin importar `SharedModule` explícitamente
**Then** la inyección funciona sin error.
