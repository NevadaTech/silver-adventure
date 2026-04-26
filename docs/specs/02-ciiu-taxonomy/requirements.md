# 02 — CIIU Taxonomy · Requirements

> Bounded context que gestiona la taxonomía oficial **DIAN CIIU rev 4** usada por todos los demás contextos para resolver división, grupo, sección y títulos a partir de un código CIIU de 4 dígitos.

> Aplica `ARQ-001` (hexagonal), `ARQ-003` (Supabase), `ARQ-007` (TDD).

---

## Metadata de implementación

| Campo                | Valor                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orden**            | **Phase 2**                                                                                                                                                          |
| **Owner**            | 🟡 **PAIR** (los dos devs juntos)                                                                                                                                    |
| **Depende de**       | `01-shared` (necesita `SupabaseClient`, `CsvLoader`, `Logger`)                                                                                                       |
| **Prerrequisito de** | `03-companies` (entity usa division/grupo), `04-clusters` (HeuristicClusterer.findByDivision/findByGrupo), `05-recommendations` (CandidateSelector usa la jerarquía) |
| **Paralelizable**    | ❌ **NO** — bloquea downstream                                                                                                                                       |
| **Bloqueante**       | ✅ **SÍ** — camino crítico                                                                                                                                           |
| **Tasks del plan**   | Task 2.1 → 2.3 + Task 7.1 (seed CIIU DIAN)                                                                                                                           |
| **Estimación**       | ~½ día (es chico, pero requiere descargar el CSV oficial DIAN primero)                                                                                               |

**Pre-trabajo manual:** descargar el archivo `CIIU_Rev_4_AC.xlsx` del DANE (`https://www.dane.gov.co/files/sen/nomenclatura/ciiu/CIIU_Rev_4_AC.xlsx`) y convertirlo a CSV con el header esperado. Ver Task 0.4 del plan.

---

## CIIU-REQ-001 — Entity `CiiuActivity`

**Como** sistema
**Necesito** una entidad inmutable que represente una actividad económica DIAN
**Para** que los demás contextos consulten información estructurada (no strings sueltos).

**Criterios:**

- Entity en `domain/entities/CiiuActivity.ts`.
- Constructor privado, factory `CiiuActivity.create({...})` con validación.
- Props requeridas:
  - `code: string` (4 dígitos, ej. `'4711'`)
  - `seccion: string` (1 letra, ej. `'G'`)
  - `division: string` (2 dígitos, ej. `'47'`, debe coincidir con `code.slice(0,2)`)
  - `grupo: string` (3 dígitos, ej. `'471'`, debe coincidir con `code.slice(0,3)`)
  - `tituloActividad: string` (no vacío)
  - `tituloSeccion: string`
  - `tituloDivision: string`
  - `tituloGrupo: string`
  - `macroSector: string | null` (nullable)
- Factory tira si:
  - `code` no es exactamente 4 dígitos
  - `division` no coincide con primeros 2 dígitos
  - `grupo` no coincide con primeros 3 dígitos
  - `seccion` no es 1 letra mayúscula

---

## CIIU-REQ-002 — Port `CiiuTaxonomyRepository`

**Como** otros bounded contexts
**Necesito** consultar la taxonomía vía un port abstracto
**Para** no acoplarme a Supabase.

**Criterios:**

- Port en `domain/repositories/CiiuTaxonomyRepository.ts`.
- Métodos:
  - `findByCode(code: string): Promise<CiiuActivity | null>`
  - `findByCodes(codes: string[]): Promise<CiiuActivity[]>`
  - `findBySection(seccion: string): Promise<CiiuActivity[]>`
  - `findByDivision(division: string): Promise<CiiuActivity[]>`
  - `findByGrupo(grupo: string): Promise<CiiuActivity[]>` — **requerido por `HeuristicClusterer` pase 2 (ARQ-005)**
  - `saveAll(activities: CiiuActivity[]): Promise<void>` — usado por seed
- Token de inyección: `CIIU_TAXONOMY_REPOSITORY`.

---

## CIIU-REQ-003 — Adapter `SupabaseCiiuTaxonomyRepository`

**Como** sistema
**Necesito** persistir y consultar la taxonomía en Supabase
**Para** que las queries sean rápidas (índice en `division`, `grupo`, `seccion`).

**Criterios:**

- Adapter en `infrastructure/repositories/SupabaseCiiuTaxonomyRepository.ts` que implementa `CiiuTaxonomyRepository`.
- Tabla `ciiu_taxonomy` con índices en `seccion`, `division`, `grupo`.
- `saveAll` hace upsert por chunks de 500 (~700 filas total, evita timeout).
- Mapeo `row → CiiuActivity.create({...})` en método privado `toEntity(row)`.

---

## CIIU-REQ-004 — Use case `FindCiiuByCode`

**Como** otros contextos (companies, recommendations)
**Necesito** un use case explícito para consultar una actividad por código
**Para** que el flujo de consulta sea testeable y mockeable.

**Criterios:**

- Use case en `application/use-cases/FindCiiuByCode.ts`.
- Input: `{ code: string }`.
- Output: `{ activity: CiiuActivity | null }`.
- Inyecta `CIIU_TAXONOMY_REPOSITORY`.

---

## CIIU-REQ-005 — Carga inicial desde CSV DIAN

**Como** sistema
**Necesito** poblar la tabla `ciiu_taxonomy` desde el CSV oficial DIAN rev 4
**Para** que los demás contextos puedan resolver la jerarquía.

**Criterios:**

- Seed `seed-ciiu-taxonomy.ts` en `src/seeds/`.
- Lee `docs/hackathon/DATA/CIIU_DIAN.csv` (descargado del DANE oficial: `https://www.dane.gov.co/files/sen/nomenclatura/ciiu/CIIU_Rev_4_AC.xlsx`, convertido a CSV).
- Headers esperados: `code,seccion,division,grupo,titulo_actividad,titulo_seccion,titulo_division,titulo_grupo,macro_sector`.
- Crea `CiiuActivity` por cada fila vía factory (skippea filas inválidas con log).
- Llama `repo.saveAll(activities)`.
- Idempotente: si se corre dos veces no duplica (upsert por `code`).

---

## CIIU-REQ-006 — Módulo NestJS

**Como** sistema
**Necesito** que `CiiuTaxonomyModule` exporte el use case y el repo token
**Para** que `CompaniesModule`, `ClustersModule` y `RecommendationsModule` los inyecten.

**Criterios:**

- `ciiu-taxonomy.module.ts` exporta:
  - `FindCiiuByCode`
  - `CIIU_TAXONOMY_REPOSITORY` (token)
- Provider de `CIIU_TAXONOMY_REPOSITORY`: `useClass: SupabaseCiiuTaxonomyRepository`.
