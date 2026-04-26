# Tasks — AI-Driven Clusters

> Change: `ai-driven-clusters`
> Branch: `feat/brain-ai-driven-clusters`
> Workspace: `src/brain`
> Phase: tasks (TDD implementation checklist)
> Inputs: proposal.md, specs/recommendations.delta.md, specs/clusters.delta.md, specs/agent.delta.md, design.md

---

## Overview by phase

| Phase     | Description                                                      | Tasks  | Files (prod) | Files (test) |
| --------- | ---------------------------------------------------------------- | ------ | ------------ | ------------ |
| A         | Schema migration + env                                           | 3      | 3            | 0            |
| B         | CiiuGraphPort + adapters                                         | 6      | 5            | 5            |
| C         | DynamicValueChainRules + matchers async                          | 6      | 5            | 4            |
| D         | EcosystemDiscoverer + LabelPropagation + GenerateClusters wiring | 9      | 8            | 5            |
| E         | Module wiring + flag integration                                 | 4      | 4            | 2            |
| F         | Documentation                                                    | 2      | 2            | 0            |
| **Total** |                                                                  | **30** | **27**       | **16**       |

---

## Phase A — Schema migration + env setup

> Goal: SQL migration idempotente para `model_version`, `AI_DRIVEN_RULES_ENABLED` en el schema Zod, y `.env.example` actualizado. Sin estos, ninguna task posterior puede probar correctamente el flag ni el campo nuevo.

### Task A.1: Migration SQL — agregar `model_version` a `ai_match_cache`

- **Phase**: A
- **Type**: schema
- **TDD step**: N/A (SQL no-código, verificación manual smoke-check post-deploy)
- **Files**:
  - `supabase/migrations/20260427000000_add_model_version_to_ai_match_cache.sql` — agrega columna `model_version text NULL` con `ADD COLUMN IF NOT EXISTS`
- **Description**: Migration aditiva e idempotente. Agrega `model_version TEXT DEFAULT NULL` a `ai_match_cache`. Entradas legacy quedan con NULL sin error. No hay backfill, no hay `NOT NULL`, sin índice (fuera de scope). El timestamp del archivo debe ser mayor al de la última migration existente (`20260426220000`).
- **Acceptance**:
  - [ ] Archivo de migration creado con la cláusula `ALTER TABLE ai_match_cache ADD COLUMN IF NOT EXISTS model_version text default null`
  - [ ] Comentario en el SQL explica por qué no hay backfill ni NOT NULL
  - [ ] `bun test` global verde (no hay tests de migration — solo verificación de que el archivo existe y compila)
  - [ ] Commit: `chore(db): add model_version column to ai_match_cache`

---

### Task A.2: Env schema — agregar `AI_DRIVEN_RULES_ENABLED`

- **Phase**: A
- **Type**: config
- **TDD step**: N/A (el schema Zod no tiene test unitario dedicado en el proyecto — la validación se verifica indirectamente al usar `env` en tests que lo importan)
- **Files**:
  - `src/brain/src/shared/infrastructure/env.ts` — agregar campo `AI_DRIVEN_RULES_ENABLED: z.enum(['true', 'false']).default('false')` al `envSchema` (mismo patrón que `AGENT_ENABLED` y `AI_MATCH_INFERENCE_ENABLED` existentes en la línea 27-28)
- **Description**: La env var controla si los tres consumidores (ValueChainMatcher, AllianceMatcher, EcosystemDiscoverer) usan el grafo dinámico. Default `'false'` garantiza comportamiento idéntico al actual en cualquier entorno que no declare la variable. Tipo `z.enum(['true','false'])` (string, no boolean) mantiene consistencia con el patrón del proyecto.
- **Acceptance**:
  - [ ] `env.AI_DRIVEN_RULES_ENABLED` tiene tipo `'true' | 'false'` (inferido desde Zod)
  - [ ] `parseEnv({})` no lanza (default `'false'` activo)
  - [ ] `bun test` global verde
  - [ ] Commit: `chore(env): add AI_DRIVEN_RULES_ENABLED feature flag`

---

### Task A.3: `.env.example` — documentar `AI_DRIVEN_RULES_ENABLED`

- **Phase**: A
- **Type**: config
- **TDD step**: N/A
- **Files**:
  - `.env.example` (en la raíz del repo) — agregar `AI_DRIVEN_RULES_ENABLED=false` con un comentario breve
- **Description**: El `.env.example` es el contrato documentado de variables. Agregar la línea en la sección de brain (junto a `AGENT_ENABLED` y `AI_MATCH_INFERENCE_ENABLED`). El comentario debe aclarar que default es `false` y que activar en `true` habilita reglas dinámicas del grafo CIIU.
- **Acceptance**:
  - [ ] `.env.example` contiene `AI_DRIVEN_RULES_ENABLED=false`
  - [ ] Hay un comentario explicativo (1 línea)
  - [ ] `bun test` global verde
  - [ ] Commit: `docs(env): document AI_DRIVEN_RULES_ENABLED in .env.example`

---

## Phase B — CiiuGraphPort + adapters

> Goal: el port `CiiuGraphPort`, el VO `CiiuEdge`, el adapter Supabase, el adapter InMemory, y el contract test que los vincula. La entidad `AiMatchCacheEntry` y su repositorio Supabase se actualizan para `model_version`. Estas piezas son insumo de Phases C y D.

### Task B.1: VO `CiiuEdge` — definición e invariants

- **Phase**: B
- **Type**: domain
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/recommendations/CiiuEdge.test.ts` — asserts: factory válida, `confidence` fuera de [0,1] lanza, `ciiuOrigen` vacío lanza, `hasMatch=true` sin `relationType` lanza, `modelVersion` acepta `null` (legacy), inmutabilidad (congelar props)
  - `src/brain/src/recommendations/domain/value-objects/CiiuEdge.ts` — clase con private constructor, `static create()`, getters, `Object.freeze` sobre props (ver design §2.1 para firma exacta)
- **Description**: Value Object que representa una arista del grafo CIIU↔CIIU. Encapsula validaciones de negocio (confidence en rango, relationType requerido cuando hasMatch=true). Es el tipo que fluye entre el port y sus consumidores.
- **Acceptance**:
  - [ ] Test rojo creado (CiiuEdge.test.ts existe y falla)
  - [ ] Test pasa con la implementación
  - [ ] Todos los invariants del design §2.1 cubiertos por asserts
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): add CiiuEdge value object`

---

### Task B.2: Port `CiiuGraphPort` — interface + symbol

- **Phase**: B
- **Type**: domain
- **TDD step**: N/A (interfaces TypeScript no tienen tests unitarios — se valida indirectamente por el contract test en B.5)
- **Files**:
  - `src/brain/src/recommendations/domain/ports/CiiuGraphPort.ts` — interface con dos métodos: `getMatchingPairs(threshold, relationTypes?): Promise<CiiuEdge[]>` y `getEdgesByOrigin(ciiuOrigen, threshold): Promise<CiiuEdge[]>`; exporta `CIIU_GRAPH_PORT = Symbol('CIIU_GRAPH_PORT')` (ver design §2.2)
- **Description**: Define el contrato del grafo CIIU. El Symbol se usa como token de DI en NestJS. El port es puro TypeScript, sin importar infraestructura ni framework. Los comentarios JSDoc en el puerto deben mencionar la exclusión de wildcards (`ciiuDestino='*'`) y que el filtrado ocurre en SQL.
- **Acceptance**:
  - [ ] Archivo existe y compila sin errores TypeScript
  - [ ] `CIIU_GRAPH_PORT` está exportado como `Symbol`
  - [ ] `bun test` global verde (TypeScript check vía test runner)
  - [ ] Commit: `feat(recommendations): add CiiuGraphPort domain port`

---

### Task B.3: `InMemoryCiiuGraphRepository` — adapter para tests

- **Phase**: B
- **Type**: infrastructure
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/recommendations/InMemoryCiiuGraphRepository.test.ts` — asserts: constructor vacío devuelve arrays vacíos, `seed()` popula, `getMatchingPairs` filtra por threshold, por relationType, excluye wildcards, `getEdgesByOrigin` filtra por ciiuOrigen
  - `src/brain/src/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository.ts` — implementa `CiiuGraphPort`, tiene `seed(edges)` helper (ver design §2.4 para implementación exacta)
- **Description**: Adapter de test que implementa `CiiuGraphPort` en memoria. Método `seed()` permite pre-cargar aristas en tests. El filtrado se hace en JavaScript (no en SQL) — a diferencia del Supabase adapter, es la implementación "honesta" para unit tests. No tiene decoradores NestJS (`@Injectable`) ya que no se registra en ningún módulo de producción.
- **Acceptance**:
  - [ ] Test rojo creado
  - [ ] Test pasa
  - [ ] Wildcards excluidos correctamente por el filtro
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): add InMemoryCiiuGraphRepository test adapter`

---

### Task B.4: `SupabaseCiiuGraphRepository` — adapter producción

- **Phase**: B
- **Type**: infrastructure
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/recommendations/SupabaseCiiuGraphRepository.test.ts` — mockear el Supabase client (mismo patrón que `SupabaseAiMatchCacheRepository.test.ts`); asserts: `getMatchingPairs` construye query con `.eq('has_match', true)`, `.gte('confidence', threshold)`, `.neq('ciiu_destino', '*')`, y `.in('relation_type', ...)` cuando se pasa `relationTypes`; `getEdgesByOrigin` agrega `.eq('ciiu_origen', ...)` al query; mapea row a `CiiuEdge` via `toCiiuEdge()`
  - `src/brain/src/recommendations/infrastructure/repositories/SupabaseCiiuGraphRepository.ts` — `@Injectable()`, inyecta `SUPABASE_CLIENT`, implementa las dos queries Supabase (ver design §2.3)
- **Description**: Adapter de producción que lee de `ai_match_cache`. El filtrado ocurre en SQL — no se traen 25k filas a memoria. La función `toCiiuEdge(row)` valida `relation_type` con `isRelationType` (mismo helper que `SupabaseAiMatchCacheRepository` usa para `toEntity`).
- **Acceptance**:
  - [ ] Test rojo creado con mock del Supabase client
  - [ ] Test pasa
  - [ ] Query builder correctamente encadenado para cada escenario
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): add SupabaseCiiuGraphRepository adapter`

---

### Task B.5: Contract test `CiiuGraphPort` — validación de ambos adapters

- **Phase**: B
- **Type**: test
- **TDD step**: RED → GREEN (el contrato falla inicialmente en la versión Supabase porque requiere mock apropiado)
- **Files**:
  - `src/brain/__tests__/recommendations/CiiuGraphPort.contract.test.ts` — suite parametrizada que corre los mismos asserts contra ambas implementaciones: threshold filter, relationType filter (uno y varios), exclusión de wildcards, `getEdgesByOrigin` correcto; `InMemoryCiiuGraphRepository` se crea directamente; `SupabaseCiiuGraphRepository` se crea con un mock del client que retorna datos pre-establecidos
- **Description**: El contract test garantiza que ambas implementaciones honran el contrato del port. Si en el futuro se agrega un tercer adapter (e.g., BigQuery), este test es el que fuerza la conformidad. Patrón: `describe.each([['InMemory', ...], ['Supabase', ...]])` o dos `describe` blocks con la misma suite de helpers extraída.
- **Acceptance**:
  - [ ] Test rojo creado para los casos del contrato
  - [ ] Pasa con ambas implementaciones
  - [ ] Al menos 4 scenarios: threshold, relationType, wildcard exclusion, empty result
  - [ ] `bun test` global verde
  - [ ] Commit: `test(recommendations): add CiiuGraphPort contract test suite`

---

### Task B.6: `AiMatchCacheEntry` + repositorios — agregar `modelVersion`

- **Phase**: B
- **Type**: domain + infrastructure
- **TDD step**: RED → GREEN (modificar tests existentes)
- **Files**:
  - `src/brain/__tests__/recommendations/AiMatchCacheEntry.test.ts` — **modificar**: agregar casos `modelVersion: 'gemini-2.5-flash'` (válido) y `modelVersion: null` (legacy, válido)
  - `src/brain/__tests__/recommendations/SupabaseAiMatchCacheRepository.test.ts` — **modificar**: verificar que `save()` escribe `model_version` en el row y que `find()` / `findAll()` lo devuelve en la entity
  - `src/brain/__tests__/recommendations/InMemoryAiMatchCacheRepository.test.ts` — **modificar**: mismo — verificar que `modelVersion` es persistido y recuperado
  - `src/brain/src/recommendations/domain/entities/AiMatchCacheEntry.ts` — **modificar**: agregar `modelVersion: string | null` a props, getter, y parámetro del factory (opcional, default `null`)
  - `src/brain/src/recommendations/infrastructure/repositories/SupabaseAiMatchCacheRepository.ts` — **modificar**: `CacheRow` agrega `model_version: string | null`; `toRow()` incluye `model_version: entry.modelVersion`; `toEntity()` pasa `modelVersion: row.model_version`
  - `src/brain/src/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository.ts` — **modificar**: el InMemory ya guarda la entity completa — verificar que `modelVersion` fluye sin cambios adicionales (trivial)
- **Description**: Agrega trazabilidad de modelo a cada entrada del cache. Es cambio aditivo — `modelVersion: null` es legacy válido en todos los paths de lectura. El campo viene de `env.GEMINI_CHAT_MODEL` (variable existente) cuando `AiMatchEngine` persiste — ese wiring se hace en Task C.4.
- **Acceptance**:
  - [ ] Tests modificados fallan en rojo antes del cambio
  - [ ] Tests pasan tras la implementación
  - [ ] `modelVersion: null` no produce error en ningún path de lectura
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): add modelVersion field to AiMatchCacheEntry`

---

## Phase C — DynamicValueChainRules + matchers async

> Goal: el helper `DynamicValueChainRules` que combina grafo + fallback, `ValueChainMatcher` y `AllianceMatcher` async con DI del helper, `AiMatchEngine` con `modelVersion`, y `GenerateRecommendations.runFallback()` async. Phase B debe estar completa antes de iniciar aquí.

### Task C.1: `DynamicValueChainRules` — helper de reglas dinámicas + fallback

- **Phase**: C
- **Type**: application
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/recommendations/DynamicValueChainRules.test.ts` — asserts: (1) `flagEnabled=false` → retorna `VALUE_CHAIN_RULES` literal sin consultar el port; (2) `flagEnabled=true` + grafo vacío → retorna `VALUE_CHAIN_RULES` (fallback completo) + loguea warning; (3) `flagEnabled=true` + grafo con aristas `proveedor/cliente` → reglas dinámicas para pares cubiertos + hardcoded solo para pares NO cubiertos (fallback selectivo); (4) `getEcosystems(false)` → retorna `ECOSYSTEMS` literal; (5) `getEcosystems(true)` + aristas aliado → ecosistemas dinámicos concatenados con `ECOSYSTEMS` hardcoded (unión completa); (6) threshold `0.65` se usa correctamente al llamar al port
  - `src/brain/src/recommendations/application/services/DynamicValueChainRules.ts` — `@Injectable()`, inyecta `CIIU_GRAPH_PORT`; métodos `getValueChainRules(flagEnabled, threshold?)` y `getEcosystems(flagEnabled, threshold?)`; constante `MATCHER_CONFIDENCE_THRESHOLD = 0.65` (ver design §2.5 para implementación completa)
- **Description**: Encapsula toda la lógica de "grafo dinámico + fallback" en un helper reusable por ambos matchers. El flag entra como parámetro (no como dependencia de construcción) para máxima testabilidad — el test pasa `true`/`false` directamente sin necesitar stubear `env`. La distinción entre fallback selectivo (rules) y unión completa (ecosystems) está especificada en design §2.5.
- **Acceptance**:
  - [ ] Test rojo creado con mock de `CiiuGraphPort` via `InMemoryCiiuGraphRepository`
  - [ ] Test pasa para los 6 scenarios
  - [ ] Fallback selectivo verificado: hardcoded solo para pares no cubiertos por grafo
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): add DynamicValueChainRules helper service`

---

### Task C.2: `ValueChainMatcher` — async + DI de `DynamicValueChainRules`

- **Phase**: C
- **Type**: application
- **TDD step**: RED → GREEN (modificar tests existentes + agregar nuevos)
- **Files**:
  - `src/brain/__tests__/recommendations/ValueChainMatcher.test.ts` — **modificar**: (a) todos los `matcher.match(companies)` existentes pasan a `await matcher.match(companies)`; (b) **agregar** test: `flag=false` → `getValueChainRules` invocada con `false`, comportamiento idéntico al actual; (c) **agregar** test: `flag=true` + grafo vacío → fallback hardcoded, sin error; (d) **agregar** test: `flag=true` + grafo con arista nueva → esa arista genera rec, regla hardcoded para par no cubierto sigue funcionando
  - `src/brain/src/recommendations/application/services/ValueChainMatcher.ts` — **modificar**: cambiar constructor para recibir `DynamicValueChainRules` por DI; `match()` pasa a `async`; al inicio del método, `const rules = await this.dynamicRules.getValueChainRules(env.AI_DRIVEN_RULES_ENABLED === 'true')`; resto de la lógica de iteración sin cambios (ver design §6)
- **Description**: Cambio de firma más inyección del helper. El comportamiento de scoring (`rule.weight × factor_municipio`) no cambia. El flag se lee de `env` dentro del matcher (una línea) y se pasa al helper como parámetro — el helper no lee `env` directamente (testabilidad).
- **Acceptance**:
  - [ ] Tests existentes pasan con `await`
  - [ ] Tests nuevos (flag=false, flag=true+vacío, flag=true+arista nueva) en rojo antes del cambio
  - [ ] Tests nuevos pasan tras la implementación
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): make ValueChainMatcher async with dynamic graph support`

---

### Task C.3: `AllianceMatcher` — async + DI de `DynamicValueChainRules`

- **Phase**: C
- **Type**: application
- **TDD step**: RED → GREEN (modificar tests existentes + agregar nuevos)
- **Files**:
  - `src/brain/__tests__/recommendations/AllianceMatcher.test.ts` — **modificar**: mismo patrón que C.2 — `await matcher.match(companies)` en todos los existentes; **agregar**: test `flag=false`, `flag=true`+grafo vacío, `flag=true`+aristas aliado (rec emitida usando arista dinámica)
  - `src/brain/src/recommendations/application/services/AllianceMatcher.ts` — **modificar**: constructor recibe `DynamicValueChainRules`; `match()` async; `const ecosystems = await this.dynamicRules.getEcosystems(env.AI_DRIVEN_RULES_ENABLED === 'true')`; resto idéntico (dedupe por `aId|bId` ya existente absorbe duplicados) (ver design §7)
- **Description**: Análogo exacto a C.2 pero para alianzas. La lógica de unión completa (ecosistemas dinámicos + hardcoded) ya está en el helper — el matcher no necesita cambios adicionales más allá de la firma async y el DI. Score formula (`mismo_municipio ? 0.75 : 0.55`) no cambia.
- **Acceptance**:
  - [ ] Tests existentes pasan con `await`
  - [ ] Tests nuevos (3 scenarios adicionales) en rojo → pasan
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): make AllianceMatcher async with dynamic graph support`

---

### Task C.4: `AiMatchEngine` — persistir `modelVersion` al hacer `put()`

- **Phase**: C
- **Type**: application
- **TDD step**: RED → GREEN (modificar test existente)
- **Files**:
  - `src/brain/__tests__/recommendations/AiMatchEngine.test.ts` — **modificar**: verificar que cuando `AiMatchEngine` persiste un resultado, la `AiMatchCacheEntry` creada tiene `modelVersion` igual a `env.GEMINI_CHAT_MODEL`; agregar assert en el test de cache-miss que inspecciona el argumento pasado a `cache.put()`
  - `src/brain/src/recommendations/application/services/AiMatchEngine.ts` — **modificar**: en el método `persist()` (o equivalente), pasar `modelVersion: env.GEMINI_CHAT_MODEL` al factory `AiMatchCacheEntry.create()`
- **Description**: Cierra el loop del design §9.6. `GEMINI_CHAT_MODEL` ya existe en el schema Zod (línea 34 del env.ts actual) — no se crea nueva variable. La spec AGT-REQ-NEW-001 menciona `GEMINI_MODEL_VERSION` pero el design ratifica usar `GEMINI_CHAT_MODEL` (mismo significado, variable existente).
- **Acceptance**:
  - [ ] Test modificado falla en rojo antes del cambio (el assert de `modelVersion` no existe aún)
  - [ ] Test pasa tras agregar `modelVersion: env.GEMINI_CHAT_MODEL` en el persist
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): persist modelVersion in AiMatchEngine cache entries`

---

### Task C.5: `GenerateRecommendations.runFallback()` — pasar a async

- **Phase**: C
- **Type**: application
- **TDD step**: RED → GREEN (modificar test existente)
- **Files**:
  - `src/brain/__tests__/recommendations/GenerateRecommendations.test.ts` — **modificar**: los tests ya usan `await execute()` (el use case ya es async), así que verificar que el test pasa sin más cambios; si hay algún assert interno que espíe `runFallback` como síncrono, ajustar
  - `src/brain/src/recommendations/application/use-cases/GenerateRecommendations.ts` — **modificar**: `private runFallback(companies): ...` pasa a `private async runFallback(companies): Promise<...>`; dentro del método, `await this.valueChain.match(...)` y `await this.alliance.match(...)`; los dos call sites de `runFallback` en el use case pasan a `await this.runFallback(...)` (ver design §7.3)
- **Description**: Coordinación necesaria para que los matchers async no produzcan un `Promise` no-awaiteado. El use case `execute()` ya es `async`, por lo que no hay cambio de API pública. Es el más mecánico de los tasks de Phase C.
- **Acceptance**:
  - [ ] `runFallback` es async en el código de producción
  - [ ] Los dos call sites de `runFallback` tienen `await`
  - [ ] Tests existentes de `GenerateRecommendations` siguen pasando
  - [ ] `bun test` global verde
  - [ ] Commit: `fix(recommendations): make runFallback async for async matchers`

---

### Task C.6: Regresión — comportamiento flag=false idéntico al actual

- **Phase**: C
- **Type**: test
- **TDD step**: GREEN (test de regresión — debe pasar sin cambios de producción)
- **Files**:
  - `src/brain/__tests__/recommendations/ValueChainMatcher.test.ts` — **agregar** (dentro de los tests existentes o en describe separado): snapshot/assertion explícita de que con `AI_DRIVEN_RULES_ENABLED='false'` el output de `match(companies)` es binariamente idéntico al output pre-change (mismo número de recs, mismo score)
  - `src/brain/__tests__/recommendations/AllianceMatcher.test.ts` — mismo
- **Description**: Test de regresión explícito para el camino `flag=false`. Confirma que el cambio de firma async y el DI del helper no alteran el comportamiento cuando el flag está off. Puede ejecutarse con un fixture de empresas fijo (ej. 3 empresas con CIIUs de las reglas hardcoded existentes) y comparar el output contra el esperado pre-change.
- **Acceptance**:
  - [ ] Tests de regresión pasan en verde desde el inicio (no son tests nuevos de comportamiento, son confirmaciones de no-cambio)
  - [ ] Si alguno falla, indica regresión real y hay que corregir el código de producción
  - [ ] `bun test` global verde
  - [ ] Commit: `test(recommendations): add regression tests for flag=false behavior`

---

## Phase D — EcosystemDiscoverer + LabelPropagation + GenerateClusters

> Goal: el algoritmo `LabelPropagation`, el servicio `EcosystemDiscoverer`, la extensión de `ClusterType` y `Cluster.create()`, `deleteByType` en el port y adapters, y el tercer pase en `GenerateClusters`. Depende de Phase B para `CiiuGraphPort`.

### Task D.1: `ClusterType` — agregar `'heuristic-ecosistema'`

- **Phase**: D
- **Type**: domain
- **TDD step**: RED → GREEN (modificar test existente)
- **Files**:
  - `src/brain/__tests__/clusters/Cluster.test.ts` — **modificar**: agregar caso `tipo='heuristic-ecosistema'` con ID válido formato `eco-ab12ef34-santa-marta`, `municipio` no nulo, `ciiuDivision: null`, `ciiuGrupo: null` → `Cluster.create()` no lanza; agregar caso `municipio: null` → lanza; agregar caso `ciiuDivision: '47'` → lanza
  - `src/brain/src/clusters/domain/value-objects/ClusterType.ts` — **modificar**: agregar `'heuristic-ecosistema'` al array `CLUSTER_TYPES`
  - `src/brain/src/clusters/domain/entities/Cluster.ts` — **modificar**: en `Cluster.create()`, agregar rama de validación para `tipo='heuristic-ecosistema'`: exigir `municipio` no nulo, exigir `ciiuDivision === null` y `ciiuGrupo === null`; validar que el ID cumple el patrón `eco-{8hex}-{slug}` (regex: `/^eco-[0-9a-f]{8}-[a-z0-9-]+$/`)
- **Description**: Cambio aditivo en el dominio. Los tipos existentes (`predefined`, `heuristic-division`, `heuristic-grupo`, `heuristic-municipio`) no se tocan. El nuevo tipo tiene sus propias reglas de validación en el factory. El patrón de ID es específico del ecosistema y no debe confundirse con los IDs de otros tipos heurísticos.
- **Acceptance**:
  - [ ] Tests nuevos en rojo antes del cambio
  - [ ] Tests pasan con `ClusterType` extendido y validación en `Cluster.create()`
  - [ ] Tests existentes del dominio `Cluster` siguen en verde
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(clusters): add heuristic-ecosistema cluster type with validation`

---

### Task D.2: `ClusterRepository` port — agregar `deleteByType()`

- **Phase**: D
- **Type**: domain
- **TDD step**: N/A (interface pura — verificación indirecta por adapters en D.3 y D.4)
- **Files**:
  - `src/brain/src/clusters/domain/repositories/ClusterRepository.ts` — **modificar**: agregar `deleteByType(tipo: ClusterType): Promise<void>` al interface
- **Description**: Extensión mínima del port para soportar la limpieza selectiva de clusters de ecosistema antes de regenerarlos (CLU-REQ-NEW-007). El método debe venir DESPUÉS de los métodos existentes en la interface. El tipo de `tipo` ya es `ClusterType` (el VO existente, que ahora incluye `'heuristic-ecosistema'`).
- **Acceptance**:
  - [ ] Interface compilable sin errores TypeScript
  - [ ] Las implementaciones existentes (`Supabase*` e `InMemory*`) producen error de TypeScript al no implementar el método — esto obliga a D.3 y D.4
  - [ ] `bun test` global rojo en D.3 y D.4 (los adapters no compilan aún) → verde tras D.3 y D.4
  - [ ] Commit: `feat(clusters): add deleteByType to ClusterRepository port`

---

### Task D.3: `InMemoryClusterRepository` — implementar `deleteByType()`

- **Phase**: D
- **Type**: infrastructure
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/clusters/InMemoryClusterRepository.test.ts` — **modificar**: agregar test: pre-cargar 3 clusters `heuristic-ecosistema` y 2 `predefined`; invocar `deleteByType('heuristic-ecosistema')`; verificar que quedan solo los 2 `predefined`; agregar test: `deleteByType` con tipo sin clusters → no lanza (no-op)
  - `src/brain/src/clusters/infrastructure/repositories/InMemoryClusterRepository.ts` — **modificar**: implementar `deleteByType(tipo)` con `this.clusters = this.clusters.filter(c => c.tipo !== tipo)` (o equivalente según la implementación actual del InMemory)
- **Description**: Implementación trivial en memoria. La lógica de filtro es una línea. El test verifica que otros tipos no son eliminados (aislamiento). El test de no-op verifica que invocar con tipo ausente no lanza.
- **Acceptance**:
  - [ ] Tests nuevos en rojo antes del cambio
  - [ ] Tests pasan con la implementación
  - [ ] Tests existentes del InMemory repo siguen en verde
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(clusters): implement deleteByType in InMemoryClusterRepository`

---

### Task D.4: `SupabaseClusterRepository` — implementar `deleteByType()`

- **Phase**: D
- **Type**: infrastructure
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/clusters/SupabaseClusterRepository.test.ts` — **modificar**: agregar test: mock del Supabase client; verificar que `deleteByType('heuristic-ecosistema')` invoca `.from('clusters').delete().eq('tipo', 'heuristic-ecosistema')`; verificar que un error de Supabase se propaga como throw
  - `src/brain/src/clusters/infrastructure/repositories/SupabaseClusterRepository.ts` — **modificar**: implementar `async deleteByType(tipo: ClusterType): Promise<void>` con query `this.db.from('clusters').delete().eq('tipo', tipo)`; propagación de error si `error` está presente
- **Description**: Implementación SQL del delete selectivo. Mismo patrón que otros métodos de delete en el repositorio Supabase existente. El campo `tipo` en la tabla es `text not null` (sin constraint CHECK según design §9.2), así que el string se pasa directamente.
- **Acceptance**:
  - [ ] Tests nuevos en rojo antes del cambio
  - [ ] Tests pasan con la implementación
  - [ ] Propagación de error de Supabase verificada
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(clusters): implement deleteByType in SupabaseClusterRepository`

---

### Task D.5: `LabelPropagation` — algoritmo puro determinístico

- **Phase**: D
- **Type**: application
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/clusters/LabelPropagation.test.ts` — asserts: (1) grafo de 5 nodos totalmente conectados → 1 comunidad; (2) dos sub-grafos desconectados → 2 comunidades separadas; (3) tie-break: dos nodos con misma frecuencia → se elige label alfabéticamente menor; (4) mismo input → mismo output en dos corridas (determinismo); (5) `MAX_ITERATIONS=20` como cap — grafo patológico que no converge se detiene en 20 iteraciones; (6) wildcards excluidos (llegan ya filtrados del port, pero testear con CIIU `'*'` que NO debería estar en el input)
  - `src/brain/src/clusters/application/services/LabelPropagation.ts` — función pura `labelPropagation(edges: CiiuEdge[], maxIterations: number): string[][]`; función auxiliar `splitIfTooLarge(community: string[], maxSize: number): string[][]`; función `slugLower(s: string): string` (NFD, strip diacríticos, lowercase, espacios→'-'); función `buildEcosystemClusterId(sortedCiius: string[], municipio: string): string` usando `crypto.createHash('sha1')` (ver design §4.2 y §4.6)
- **Description**: Corazón del algoritmo. Funciones puras, sin dependencias de NestJS ni de Supabase. Esto lo hace trivialmente testeable — el test solo necesita `CiiuEdge[]` de input y verifica `string[][]` de output. La función `slugLower` es LOCAL a este archivo y es DIFERENTE del `slug()` de `HeuristicClusterer` (que usa UPPERCASE con `_`) — no reusar ni modificar el de HeuristicClusterer.
- **Acceptance**:
  - [ ] Tests en rojo antes del cambio
  - [ ] Tests pasan para todos los scenarios incluyendo tie-break
  - [ ] Dos corridas con mismo input → mismo output (determinismo)
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(clusters): add LabelPropagation algorithm and helpers`

---

### Task D.6: `EcosystemId` — generación determinística de ID y título

- **Phase**: D
- **Type**: application
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/clusters/EcosystemId.test.ts` — asserts: (1) `buildEcosystemClusterId(['5511','9601'], 'Santa Marta')` produce `eco-{sha1('5511-9601')[0..8]}-santa-marta` (valor hardcodeado esperado en el test, calculado una vez); (2) mismo set de CIIUs en orden diferente → mismo ID (el sort es interno); (3) CIIUs distintos → ID distinto; (4) mismo hash, diferente municipio → ID distinto; (5) `slugLower('Bogotá D.C.')` → `'bogota-d.c.'` (diacríticos removidos, lowercase, espacios→'-')
  - (las funciones ya existen en `LabelPropagation.ts` del Task D.5 — este test importa desde allí)
- **Description**: Test dedicado a la estabilidad del ID y a la función `slugLower`. Se hace en un archivo separado (`EcosystemId.test.ts`) para mantener `LabelPropagation.test.ts` enfocado en el algoritmo. El valor sha1 esperado se computa una vez con `node -e "require('crypto').createHash('sha1').update('5511-9601').digest('hex')"` y se hardcodea en el test.
- **Acceptance**:
  - [ ] Tests en rojo antes del cambio (las funciones aún no existen o no están exportadas)
  - [ ] Tests pasan tras la implementación en D.5 (las funciones son exportadas desde `LabelPropagation.ts`)
  - [ ] SHA-1 del test verificado manualmente antes de commitear
  - [ ] `bun test` global verde
  - [ ] Commit: `test(clusters): add deterministic ID and slug tests for ecosystem clusters`

---

### Task D.7: `EcosystemDiscoverer` — servicio completo de discovery

- **Phase**: D
- **Type**: application
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/clusters/EcosystemDiscoverer.test.ts` — asserts: (1) grafo vacío → `[]` + loguea warning (spy en logger); (2) comunidad de 2 CIIUs (< MIN_SIZE=3) → descartada, retorna `[]`; (3) comunidad de 5 CIIUs con 7 empresas en Santa Marta → 1 cluster `heuristic-ecosistema`, 7 members; (4) comunidad de 20 CIIUs → splittada en sub-comunidades de ≤15; (5) misma comunidad CIIU, empresas en dos municipios → 2 clusters separados; (6) IDs son estables entre dos llamadas con mismo grafo y mismas empresas; (7) empresas con CIIUs fuera de la comunidad detectada → no incluidas en los members del cluster
  - `src/brain/src/clusters/application/services/EcosystemDiscoverer.ts` — `@Injectable()`, inyecta `CIIU_GRAPH_PORT` y crea `Logger` (patrón de `HeuristicClusterer`); método `async discover(companies: Company[]): Promise<EcosystemDiscoveryResult[]>`; usa funciones de `LabelPropagation.ts`; constantes estáticas `MIN_SIZE=3`, `MAX_SIZE=15`, `MAX_ITERATIONS=20`, `CONFIDENCE_THRESHOLD=0.70` (ver design §2.6 y §4.5)
- **Description**: El servicio orquesta: leer grafo del port, correr label propagation, filtrar por MIN_SIZE, splittar por MAX_SIZE, materializar clusters por comunidad×municipio. Reutiliza `Cluster.create()` con el nuevo tipo `heuristic-ecosistema`. El test usa `InMemoryCiiuGraphRepository` como port — NO usa mocks de NestJS Testing (o los usa si ya es el patrón del proyecto, ver `HeuristicClusterer.test.ts` para referencia).
- **Acceptance**:
  - [ ] Tests en rojo antes del cambio
  - [ ] Tests pasan para los 7 scenarios
  - [ ] El warning del logger es verificado con spy
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(clusters): add EcosystemDiscoverer service with label propagation`

---

### Task D.8: `GenerateClusters` — tercer pase de ecosistemas

- **Phase**: D
- **Type**: application
- **TDD step**: RED → GREEN (modificar tests existentes + agregar nuevos)
- **Files**:
  - `src/brain/__tests__/clusters/GenerateClusters.test.ts` — **modificar**: (a) agregar `EcosystemDiscoverer` stub a los tests existentes (el use case ahora lo necesita en el constructor — si aún no está en los tests existentes, agregarlos como stub no-op que retorna `[]`); (b) **agregar** test: `AI_DRIVEN_RULES_ENABLED='false'` → `ecosystemClusters: 0`, `EcosystemDiscoverer.discover` nunca invocado; (c) **agregar** test: `AI_DRIVEN_RULES_ENABLED='true'` + discoverer stub que retorna 3 resultados → 3 clusters persistidos, `deleteByType('heuristic-ecosistema')` invocado, `ecosystemClusters: 3`; (d) **agregar** test: discoverer retorna `[]` → no error, `ecosystemClusters: 0`
  - `src/brain/src/clusters/application/use-cases/GenerateClusters.ts` — **modificar**: agregar `EcosystemDiscoverer` como dependencia en el constructor; en `execute()`, agregar el tercer pase condicional; llamar `clusterRepo.deleteByType('heuristic-ecosistema')` antes del `saveMany` de ecosistemas; extender el return type con `ecosystemClusters: number` (ver design §8)
- **Description**: Integración del tercer pase en el use case. `EcosystemDiscoverer` se inyecta siempre (simplifica el wiring de NestJS); el flag se resuelve en `execute()`. El orden de operaciones es importante: (1) discover, (2) deleteByType, (3) deleteAll membresías, (4) saveMany clusters, (5) saveMany membresías. Si el discoverer falla, el error se propaga y `deleteByType` no habrá ejecutado — estado consistente.
- **Acceptance**:
  - [ ] Tests existentes pasan con el stub no-op de `EcosystemDiscoverer`
  - [ ] Tests nuevos en rojo → pasan tras la implementación
  - [ ] `deleteByType` es invocado solo cuando `flag=true`
  - [ ] `ecosystemClusters` está en el return type
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(clusters): add EcosystemDiscoverer third pass to GenerateClusters`

---

### Task D.9: Regresión — comportamiento de `GenerateClusters` con flag=false

- **Phase**: D
- **Type**: test
- **TDD step**: GREEN (test de regresión — debe pasar sin cambios adicionales de producción)
- **Files**:
  - `src/brain/__tests__/clusters/GenerateClusters.test.ts` — **agregar**: test explícito que compara el output con `flag=false` contra los valores pre-change: `predefinedClusters + heuristicClusters` idénticos, `ecosystemClusters: 0`, `totalMemberships` idéntico; usa las mismas fixtures de empresas que los tests existentes
- **Description**: Garantiza que el tercer pase no afecta los dos primeros cuando el flag está off. Verifica que el `deleteByType` no se invoca y que las membresías totales son las mismas que antes del change. Puede reusar los fixtures existentes del test de `GenerateClusters`.
- **Acceptance**:
  - [ ] Test pasa en verde desde el inicio (si no, hay regresión real en D.8)
  - [ ] `ecosystemClusters: 0` en el output con flag=false
  - [ ] `deleteByType` nunca invocado con flag=false (verificar con spy)
  - [ ] `bun test` global verde
  - [ ] Commit: `test(clusters): add regression test for GenerateClusters with flag=false`

---

## Phase E — Module wiring + flag integration

> Goal: conectar todo en NestJS. `RecommendationsModule` exporta el port. `ClustersModule` importa el módulo y provee el discoverer. Tests de wiring de módulos. Depende de Phases B, C, D.

### Task E.1: `RecommendationsModule` — proveer y exportar `CiiuGraphPort`

- **Phase**: E
- **Type**: wiring
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/src/recommendations/recommendations.module.ts` — **modificar**: agregar en `providers`: `{ provide: CIIU_GRAPH_PORT, useClass: SupabaseCiiuGraphRepository }` y `DynamicValueChainRules`; agregar en `exports`: `CIIU_GRAPH_PORT`; agregar DI de `DynamicValueChainRules` en los providers de `ValueChainMatcher` y `AllianceMatcher` (si NestJS los registra con `useClass`, el framework inyecta automáticamente); (ver design §3.1)
  - `src/brain/__tests__/recommendations/RecommendationsController.test.ts` — **verificar** (puede requerir pequeño ajuste si el test usa `TestingModule` con los providers manuales): que el módulo compila y los tests existentes siguen pasando con los nuevos providers
- **Description**: Wiring de producción para el módulo de recomendaciones. El port `CIIU_GRAPH_PORT` se exporta para que `ClustersModule` pueda consumirlo. `DynamicValueChainRules` se provee aquí porque necesita `CIIU_GRAPH_PORT` como dependencia. `ValueChainMatcher` y `AllianceMatcher` reciben `DynamicValueChainRules` vía DI automática de NestJS.
- **Acceptance**:
  - [ ] Módulo compila sin errores de DI
  - [ ] Tests existentes del controller siguen en verde
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(recommendations): wire CiiuGraphPort and DynamicValueChainRules in module`

---

### Task E.2: `ClustersModule` — importar `RecommendationsModule` y proveer `EcosystemDiscoverer`

- **Phase**: E
- **Type**: wiring
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/src/clusters/clusters.module.ts` — **modificar**: agregar `RecommendationsModule` al array `imports` (sin `forwardRef` — dependencia unidireccional clusters → recommendations); agregar `EcosystemDiscoverer` al array `providers`; agregar `EcosystemDiscoverer` como dependencia en el constructor de `GenerateClusters` (si NestJS lo inyecta auto) (ver design §3.2)
  - `src/brain/__tests__/clusters/ClustersController.test.ts` — **verificar**: que el módulo sigue compilando; si el test de controller usa `TestingModule` con providers manuales, agregar el stub de `EcosystemDiscoverer`
- **Description**: El import de `RecommendationsModule` es lo que expone `CIIU_GRAPH_PORT` al `ClustersModule`. NestJS resuelve la cadena: `ClustersModule` → importa `RecommendationsModule` → `RecommendationsModule` exporta `CIIU_GRAPH_PORT` → `EcosystemDiscoverer` lo inyecta. La dependencia es unidireccional — `RecommendationsModule` no importa `ClustersModule`.
- **Acceptance**:
  - [ ] Módulo compila sin errores de DI circular
  - [ ] Tests existentes del clusters controller siguen en verde
  - [ ] `bun test` global verde
  - [ ] Commit: `feat(clusters): wire EcosystemDiscoverer and RecommendationsModule import`

---

### Task E.3: Test de integración — módulos wiring correcto

- **Phase**: E
- **Type**: test
- **TDD step**: RED → GREEN
- **Files**:
  - `src/brain/__tests__/clusters/GenerateClusters.test.ts` — **agregar** (o en archivo nuevo si el equipo prefiere): test de integración end-to-end del use case con todos los adapters InMemory y el grafo fake; crea `InMemoryCiiuGraphRepository` con aristas reales, `InMemoryClusterRepository`, `InMemoryClusterMembershipRepository`, `InMemoryCompanyRepository`, un stub de `EcosystemDiscoverer` real (no mock) instanciado con el InMemoryGraph; verifica que con `flag=true` y grafo con comunidad de 3+ CIIUs, `GenerateClusters.execute()` retorna `ecosystemClusters >= 1`
- **Description**: Test de integración que verifica el flujo completo sin mocks de NestJS — solo adapters InMemory. Detecta problemas de wiring que los tests unitarios no pueden ver (e.g., el discoverer recibe el grafo correcto, el repositorio recibe los clusters correctos).
- **Acceptance**:
  - [ ] Test en rojo antes de E.1 y E.2 (el wiring aún no está)
  - [ ] Test pasa tras E.1 y E.2
  - [ ] Flujo end-to-end verificado: grafo fake → comunidad → cluster materializado → persistido
  - [ ] `bun test` global verde
  - [ ] Commit: `test(clusters): add integration test for full GenerateClusters flow with ecosystems`

---

### Task E.4: Smoke check — `AI_DRIVEN_RULES_ENABLED` leída correctamente en runtime

- **Phase**: E
- **Type**: test
- **TDD step**: GREEN (verificación manual + test unitario simple)
- **Files**:
  - `src/brain/__tests__/recommendations/DynamicValueChainRules.test.ts` — **verificar** (ya cubierto en C.1): el test de flag=false pasa `false` como parámetro explícito; agregar si no existe: un test que simula leer `env.AI_DRIVEN_RULES_ENABLED === 'true'` pasando el booleano al helper (verifica la conversión string→boolean que hace el matcher antes de pasar al helper)
  - `src/brain/__tests__/clusters/GenerateClusters.test.ts` — **verificar** (ya cubierto en D.8): que el test con flag=false no invoca el discoverer
- **Description**: La lectura de `env.AI_DRIVEN_RULES_ENABLED === 'true'` (comparación string) ocurre en `ValueChainMatcher`, `AllianceMatcher` y `GenerateClusters`. Este task verifica que no hay bugs de coerción (e.g., `'false' === 'true'` es `false`, no hay typo). No requiere nuevo código de producción — es un checkpoint de calidad.
- **Acceptance**:
  - [ ] La comparación string-to-boolean es correcta en los tres consumidores
  - [ ] `bun test` global verde
  - [ ] Commit: `test(shared): verify AI_DRIVEN_RULES_ENABLED flag reading in consumers`

---

## Phase F — Documentation

> Goal: actualizar documentación existente. Dos archivos, mínimo cambio necesario. Sin crear nueva documentación no pedida.

### Task F.1: Actualizar `docs/scoring.md` — mencionar reglas dinámicas

- **Phase**: F
- **Type**: docs
- **TDD step**: N/A
- **Files**:
  - `docs/scoring.md` — **modificar**: en la sección de `ValueChainMatcher` y `AllianceMatcher`, agregar una nota corta (1-3 líneas) que cuando `AI_DRIVEN_RULES_ENABLED=true`, las reglas se completan con aristas de `ai_match_cache` con `confidence >= 0.65`; en la sección de clusters (o equivalente), mencionar `heuristic-ecosistema` como nuevo tipo generado por label propagation con threshold `0.70`
- **Description**: El `docs/scoring.md` describe cómo el sistema calcula scores y qué reglas aplica. Sin este update, el documento queda desactualizado y confunde a cualquier lector post-change. El update es aditivo — no se elimina ningún contenido existente.
- **Acceptance**:
  - [ ] `docs/scoring.md` menciona `AI_DRIVEN_RULES_ENABLED`, threshold `0.65` para matchers y `0.70` para community detection
  - [ ] `docs/scoring.md` menciona `heuristic-ecosistema` como tipo de cluster
  - [ ] `bun test` global verde
  - [ ] Commit: `docs(scoring): document dynamic rules and ecosystem cluster type`

---

### Task F.2: Actualizar `AGENTS.md` — nueva dependencia `clusters → recommendations`

- **Phase**: F
- **Type**: docs
- **TDD step**: N/A
- **Files**:
  - `AGENTS.md` (en la raíz del repo) — **modificar**: en la sección de bounded contexts o de arquitectura, agregar un párrafo corto mencionando que `ClustersModule` importa `RecommendationsModule` para consumir `CiiuGraphPort`; aclarar que la dependencia es unidireccional (clusters → recommendations, no al revés); mencionar que `EcosystemDiscoverer` usa label propagation sobre el grafo para detectar comunidades CIIU
- **Description**: `AGENTS.md` es el contrato de referencia para cualquier agente AI que trabaje en el repo. Sin este update, un futuro agente que lea los módulos confundirá la dependencia entre bounded contexts como un error de arquitectura. El párrafo debe ser CORTO (3-5 líneas máximo).
- **Acceptance**:
  - [ ] `AGENTS.md` menciona la dependencia `ClustersModule → RecommendationsModule` vía `CiiuGraphPort`
  - [ ] El texto es conciso (≤5 líneas)
  - [ ] `bun test` global verde
  - [ ] Commit: `docs(agents): document clusters→recommendations dependency via CiiuGraphPort`

---

## Dependency graph rápido

```
A.1 ──────────────────────────────────────────────────────────────────────► B.6
A.2 ──► C.2, C.3, C.5, D.8 (lectura de flag)
A.3 (independiente)

B.1 (CiiuEdge) ──► B.2 (port) ──► B.3 (InMemory) ──► B.5 (contract)
                                 ──► B.4 (Supabase) ──► B.5 (contract)

B.2, B.3 ──► C.1 (DynamicValueChainRules)
C.1 ──► C.2 (ValueChainMatcher async)
C.1 ──► C.3 (AllianceMatcher async)
C.2, C.3 ──► C.5 (GenerateRecommendations runFallback async)
C.2, C.3 ──► C.6 (regresión flag=false)
B.6 ──► C.4 (AiMatchEngine modelVersion)

D.1 (ClusterType+Cluster) ──► D.2 (port deleteByType) ──► D.3 (InMemory) ─► D.8
                                                         ──► D.4 (Supabase) ─►D.8
D.5 (LabelPropagation) ──► D.6 (EcosystemId)
B.3, D.1, D.5 ──► D.7 (EcosystemDiscoverer)
D.7, D.3, D.4 ──► D.8 (GenerateClusters tercer pase)
D.8 ──► D.9 (regresión)

B.4, C.1, C.2, C.3, D.7, D.8 ──► E.1 (RecommendationsModule wiring)
E.1, D.7, D.8 ──► E.2 (ClustersModule wiring)
E.2 ──► E.3 (integración end-to-end)
E.1, E.2 ──► E.4 (smoke check flag)

E.4 ──► F.1 (docs scoring)
E.4 ──► F.2 (docs AGENTS.md)
```

---

## Checklist global de tasks

### Phase A (3 tasks)

- [x] A.1 — Migration SQL `model_version` (bf9f010)
- [x] A.2 — Env schema `AI_DRIVEN_RULES_ENABLED` (4130592)
- [x] A.3 — `.env.example` documentado (32c1d41)

### Phase B (6 tasks)

- [x] B.1 — VO `CiiuEdge` (488b50b)
- [x] B.2 — Port `CiiuGraphPort` (a399a34)
- [x] B.3 — `InMemoryCiiuGraphRepository` (28a60cb)
- [x] B.4 — `SupabaseCiiuGraphRepository` (ce4bb96)
- [x] B.5 — Contract test del port (b4c21d1)
- [x] B.6 — `AiMatchCacheEntry` + repos con `modelVersion` (4a70be4)

### Phase C (6 tasks)

- [x] C.1 — `DynamicValueChainRules` (1d14ce9)
- [x] C.2 — `ValueChainMatcher` async (470c73d)
- [x] C.3 — `AllianceMatcher` async (b9193f7)
- [x] C.4 — `AiMatchEngine` con `modelVersion` (4c3a74a)
- [x] C.5 — `GenerateRecommendations.runFallback()` async (b4ad2b7)
- [x] C.6 — Regresión flag=false matchers (embedded in C.2/C.3)

### Phase D (9 tasks)

- [x] D.1 — `ClusterType` + `Cluster.create()` `heuristic-ecosistema` (16af7d0)
- [x] D.2 — `ClusterRepository` port `deleteByType` (26b1116)
- [x] D.3 — `InMemoryClusterRepository` `deleteByType` (369c760)
- [x] D.4 — `SupabaseClusterRepository` `deleteByType` (70d56f3)
- [x] D.5 — `LabelPropagation` algoritmo puro (534150e)
- [x] D.6 — `EcosystemId` IDs determinísticos (24084ce)
- [x] D.7 — `EcosystemDiscoverer` servicio completo (c2f3cdc)
- [x] D.8 — `GenerateClusters` tercer pase (dfb4360)
- [x] D.9 — Regresión flag=false `GenerateClusters` (dfb4360)

### Phase E (4 tasks)

- [x] E.1 — `RecommendationsModule` wiring (b70b1ea)
- [x] E.2 — `ClustersModule` wiring (2740af4)
- [x] E.3 — Test integración end-to-end (e114bbf)
- [x] E.4 — Smoke check flag reading (f400e0d)

### Phase F (2 tasks)

- [x] F.1 — `docs/scoring.md` (8231399)
- [x] F.2 — `AGENTS.md` (d0ad2fc)
