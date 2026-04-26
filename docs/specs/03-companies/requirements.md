# 03 — Companies · Requirements

> Bounded context que gestiona las **unidades productivas** (empresas) del dataset Ruta C.
> Aplica `ARQ-001` (hexagonal), `ARQ-002` (BQ-readiness via CompanySource), `ARQ-003` (Supabase), `ARQ-007` (TDD).

---

## Metadata de implementación

| Campo                | Valor                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orden**            | **Phase 3**                                                                                                                                          |
| **Owner**            | 🟡 **PAIR** (los dos devs juntos)                                                                                                                    |
| **Depende de**       | `01-shared` + `02-ciiu-taxonomy`                                                                                                                     |
| **Prerrequisito de** | `04-clusters` (HeuristicClusterer recibe `Company[]`), `05-recommendations` (matchers operan sobre Company), `06-agent` (sync incremental + polling) |
| **Paralelizable**    | ❌ **NO** — bloquea las dos pistas paralelas posteriores                                                                                             |
| **Bloqueante**       | ✅ **SÍ** — último eslabón del camino crítico antes de la bifurcación                                                                                |
| **Tasks del plan**   | Task 3.1 → 3.7 + Task 7.2 (seed companies)                                                                                                           |
| **Estimación**       | ~1.5 días (es el más denso del camino crítico: Etapa, Company, Repos, CompanySource port, CsvCompanySource adapter)                                  |

**Punto clave (BQ-readiness):** las Tasks 3.6 y 3.7 introducen el port `CompanySource` y el adapter `CsvCompanySource`. Esto habilita que el día que lleguen las creds de BigQuery del reto, se cree `BigQueryCompanySource` y se cambie UNA línea en el module. Sin eso, el cambio sería un refactor enorme. **NO saltearse 3.6/3.7 ni hacerlas "después".**

**🚀 Punto de bifurcación:** APENAS este contexto está verde con tests pasando, los devs se separan:

- **Dev A** → arranca `04-clusters`
- **Dev B** → arranca `05-recommendations`

---

## CMP-REQ-001 — Value Object `Etapa`

**Como** sistema
**Necesito** representar la etapa de crecimiento como value object cerrado
**Para** evitar strings sueltos como `'crecimiento'` esparcidos por el código.

**Criterios:**

- VO en `domain/value-objects/Etapa.ts`.
- Constante `ETAPAS = ['nacimiento', 'crecimiento', 'consolidacion', 'madurez'] as const`.
- Type `Etapa = typeof ETAPAS[number]`.

---

## CMP-REQ-002 — Servicio `EtapaCalculator`

**Como** factory de `Company`
**Necesito** derivar la etapa a partir de variables operativas
**Para** NO depender del campo `tipoEmpresaTamanoTITULO` del CSV (98.2% NULL en el dataset).

**Criterios:**

- Servicio en `domain/services/EtapaCalculator.ts`.
- Método: `calculate({ fechaMatricula, personal, ingreso }): Etapa`.
- Reglas (orden de evaluación):
  1. Si `fechaMatricula > hoy - 1 año` y `personal <= 5` → `'nacimiento'`
  2. Si `personal >= 50` o `ingreso >= 5_000_000_000` → `'madurez'`
  3. Si `personal >= 11` o `ingreso >= 1_000_000_000` → `'consolidacion'`
  4. En cualquier otro caso → `'crecimiento'`

---

## CMP-REQ-003 — Entity `Company`

**Como** sistema
**Necesito** una entity inmutable con factory que valide invariantes
**Para** que ninguna `Company` exista en estado inválido.

**Criterios:**

- Entity en `domain/entities/Company.ts`.
- ID: `string` (registradoMATRICULA del CSV — puede contener guiones, ej. `'0123456-7'`).
- Constructor privado, factory `Company.create({...})`.
- Props derivadas en factory:
  - `ciiu`: limpia prefijo de sección (`'G4711'` → `'4711'`)
  - `ciiuSeccion`: extraída del prefijo (`'G'`)
  - `ciiuDivision`: `code.slice(0, 2)` (`'47'`)
  - `ciiuGrupo`: `code.slice(0, 3)` (`'471'`) — **requerido por `HeuristicClusterer` pase 2 (ARQ-005)**
  - `etapa`: vía `EtapaCalculator`
- Factory tira si:
  - `id` vacío
  - `razonSocial` vacío
  - `ciiu` no es 4 dígitos tras limpiar prefijo
  - `ciiu` viene sin prefijo de sección (debería venir como `'X1234'`)

---

## CMP-REQ-004 — Port `CompanyRepository`

**Como** sistema
**Necesito** un port para persistir y consultar empresas en Supabase
**Para** que use cases y agente sean independientes del store.

**Criterios:**

- Port en `domain/repositories/CompanyRepository.ts`.
- Métodos:
  - `findAll(): Promise<Company[]>`
  - `findById(id: string): Promise<Company | null>`
  - `findUpdatedSince(date: Date): Promise<Company[]>` — usado por agente
  - `saveMany(companies: Company[]): Promise<void>` — bulk upsert por chunks
- Token: `COMPANY_REPOSITORY`.
- Implementaciones: `SupabaseCompanyRepository` (prod) + `InMemoryCompanyRepository` (tests).

---

## CMP-REQ-005 — Port `CompanySource` (BQ-readiness)

**Como** sistema
**Necesito** un port abstracto para la fuente externa de empresas
**Para** que cuando lleguen las credenciales de BigQuery del reto, el switch sea **una sola línea de código** (ARQ-002).

**Criterios:**

- Port en `domain/sources/CompanySource.ts`.
- Métodos:
  - `fetchAll(): Promise<Company[]>` — todas las empresas de la fuente
  - `fetchUpdatedSince(since: Date): Promise<Company[]>` — solo las modificadas después de la fecha
- Token: `COMPANY_SOURCE`.
- **Hoy:** implementado por `CsvCompanySource` (lee `REGISTRADOS_SII.csv`, mock del dataset).
- **Mañana:** implementado por `BigQueryCompanySource` (consulta el dataset real del reto).

---

## CMP-REQ-006 — Adapter `CsvCompanySource`

**Como** sistema (HOY, sin acceso a BQ)
**Necesito** un adapter que lea el CSV oficial del reto
**Para** poder operar mientras llegan las credenciales de BigQuery.

**Criterios:**

- Adapter en `infrastructure/sources/CsvCompanySource.ts` que implementa `CompanySource`.
- `fetchAll()`:
  - Lee `DataPaths.companiesCsv` vía `CsvLoader`.
  - Mapea cada fila a `Company.create({...})` (lógica de mapeo CSV → entity vive ACÁ, no en seed).
  - Headers del CSV: `registradoMATRICULA`, `registradoRAZONSOCIAL`, `registradosCIIU1_CODIGOSII`, `municipioTitulo`, `tipoOrganizacionTITULO`, `regitradoPERSONAL` (typo oficial), `registradoINGRESOPERACION`, `registradoACTIVOSTOTALES`, `regitradoEMAIL`, `regitradoTELEFONO1`, `regitradoDIRECCION`, `regitradoFECMATRICULA`, `regitradoFECHREN`, `registradoESTADO`.
  - Skippea filas con datos inválidos (loggea warning).
- `fetchUpdatedSince(since)`:
  - Llama `fetchAll()` y filtra in-memory por `fechaRenovacion > since`.

---

## CMP-REQ-007 — Adapter `SupabaseCompanyRepository`

**Como** sistema
**Necesito** persistir empresas en Supabase con índices que aceleren queries del motor
**Para** que el agente y las recommendations sean rápidos.

**Criterios:**

- Adapter en `infrastructure/repositories/SupabaseCompanyRepository.ts`.
- Tabla `companies` con índices: `ciiu`, `ciiu_division`, `ciiu_grupo`, `ciiu_seccion`, `municipio`, `etapa`, `updated_at`, `estado`.
- `saveMany`: upsert por chunks de 500 (10k empresas → 20 chunks).
- Trigger `set_updated_at` en la tabla actualiza `updated_at` automáticamente en cada UPDATE.

---

## CMP-REQ-008 — Use cases de consulta

**Como** controllers HTTP y agente
**Necesito** use cases explícitos para cada query
**Para** que la lógica de orquestación sea testeable.

**Criterios:**

- `GetCompanies` → retorna todas las empresas activas (paginable a futuro).
- `FindCompanyById({ id })` → retorna `{ company: Company | null }`.
- `GetCompaniesUpdatedSince({ since: Date })` → usado por agente para polling incremental.

---

## CMP-REQ-009 — Use case `SyncCompaniesFromSource`

**Como** seed inicial Y agente periódico
**Necesito** un use case que orqueste fuente → repo
**Para** que sync inicial y sync incremental sean el MISMO código.

**Criterios:**

- Use case en `application/use-cases/SyncCompaniesFromSource.ts`.
- Input: `{ since?: Date }`.
- Output: `{ synced: number }`.
- Lógica:
  1. Si `since` → `source.fetchUpdatedSince(since)`, sino `source.fetchAll()`.
  2. `repo.saveMany(companies)`.
  3. Retorna count.
- Inyecta `COMPANY_SOURCE` y `COMPANY_REPOSITORY` (ports, no implementaciones).

---

## CMP-REQ-010 — Endpoints HTTP

**Como** front Ruta C
**Necesito** consumir las empresas vía REST
**Para** mostrar listados, detalles y disparar acciones.

**Criterios:**

- Controller en `infrastructure/http/companies.controller.ts`.
- Endpoints:
  - `GET /api/companies?limit=50` → lista (con DTO sin campos sensibles)
  - `GET /api/companies/:id` → detalle (404 si no existe)
- DTO mapper `toDto(company)` excluye props internas (timestamps, props raw).

---

## CMP-REQ-011 — Seed inicial

**Como** sistema
**Necesito** un comando que pueble Supabase con las empresas del CSV
**Para** que el primer arranque tenga datos.

**Criterios:**

- Seed `seed-companies.ts` en `src/seeds/`.
- **NO duplica lógica de mapeo** — instancia `CsvCompanySource` y llama `source.fetchAll()`.
- Llama `repo.saveMany(companies)`.
- Loggea `✅ Seeded N companies (source: CsvCompanySource)`.
- Idempotente (upsert por `id`).
