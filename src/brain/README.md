# Brain — Motor inteligente de Ruta C Conecta

> Servicio NestJS que cumple el componente **"Inteligencia"** del sistema. Genera clusters de empresas, produce recomendaciones de relaciones de negocio (cliente, proveedor, aliado, referente) y orquesta un agente autónomo que corre en cron sin intervención humana.
>
> Este README explica **qué hace el brain, cómo funciona, qué rol cumple la IA y cómo está construido**. Para el contexto narrativo del producto completo ver el [README raíz](../../README.md). Para la planeación funcional ver [`docs/planeacion/`](../../docs/planeacion/). Para los specs por bounded context ver [`docs/specs/`](../../docs/specs/).

---

## 1. Qué es el brain

El brain es el **cerebro del sistema**. Es un servicio HTTP (NestJS sobre Bun/Node) que expone una API REST con cuatro responsabilidades centrales:

1. **Sincronizar empresas** desde una fuente externa (hoy CSV, mañana BigQuery).
2. **Generar clusters** de empresas en dos capas: predefinidos (estratégicos de la Cámara) y heurísticos en cascada por CIIU + municipio.
3. **Generar recomendaciones** de relaciones entre empresas usando Gemini como matcher principal con tres fallbacks heurísticos.
4. **Operar autónomamente** vía un agente con `@Cron` que corre cada 60 segundos, detecta cambios y emite eventos consumibles por el front.

El front Next.js NO habla con Supabase ni con Gemini directamente. Habla con el brain. **El brain es el único punto de acceso a la base y a la IA.** Esto cumple el patrón BFF estricto del monorepo.

> El reto del Hackathon Samatech pide explícitamente un componente "agéntico" y un "motor de clusters" con explicaciones. El brain entrega los dos: el agente Conector y el motor AI-first con razones estructuradas + texto natural cacheado.

---

## 2. Qué hace — las cuatro capacidades del motor

### 2.1. Sincronización de empresas (BigQuery-ready)

El bounded context `companies` define un **port abstracto** `CompanySource` con dos métodos:

```typescript
interface CompanySource {
  fetchAll(): Promise<Company[]>
  fetchUpdatedSince(since: Date): Promise<Company[]>
}
```

- **Hoy:** `CsvCompanySource` lee `docs/hackathon/DATA/REGISTRADOS_SII.csv` y mapea cada fila a una entity `Company` validada. La derivación de campos (limpieza de prefijo CIIU, división, grupo, sección, etapa de crecimiento) ocurre **en el adapter, no en el seed**.
- **Mañana:** cuando lleguen las credenciales de BigQuery del reto, se crea `BigQueryCompanySource` y el switch es **una sola línea** en `companies.module.ts`. Cero impacto en el resto del sistema.

El use case `SyncCompaniesFromSource` es el mismo para el seed inicial y para el agente periódico (`since` opcional).

### 2.2. Generación de clusters

Dos estrategias ortogonales corren en cada generación. Una empresa puede pertenecer a **varios clusters al mismo tiempo** (relación N:M en `cluster_members`).

**Capa A — Predefinidos (8 estratégicos de la Cámara).** Vienen del CSV oficial de la Cámara: BANANO, MANGO, YUCA, CACAO, PALMA, CAFÉ, LOGÍSTICA, TURISMO. El servicio `PredefinedClusterMatcher` lee la tabla `cluster_ciiu_mapping` y, por cada empresa, la asigna a todos los clusters cuyo CIIU corresponde al CIIU de la empresa.

**Capa B — Heurísticos en cascada de 2 niveles** (`HeuristicClusterer`):

| Pase | Granularidad                      | Umbral mínimo    | ID resultante             |
| ---- | --------------------------------- | ---------------- | ------------------------- |
| 1    | `(ciiu_division, municipio)` (2d) | `>= 5` empresas  | `div-{div}-{municipio}`   |
| 2    | `(ciiu_grupo, municipio)` (3d)    | `>= 10` empresas | `grp-{grupo}-{municipio}` |

Los pases son **ortogonales**: el grupo no necesita que la división califique. Por qué umbrales distintos: a nivel grupo hay más particiones posibles, así que pedimos más masa crítica para que el cluster valga algo. Por qué no por sección (1 letra): demasiado genérico (un cluster de 4000 empresas no recomienda nada útil). Por qué no por CIIU completo (4 dígitos): demasiado fino (clusters de 3 empresas).

Decisión documentada en [`docs/specs/00-arquitectura.md` ARQ-005](../../docs/specs/00-arquitectura.md).

### 2.3. Generación de recomendaciones — AI primero

Este es el **corazón del motor**. Cada recomendación tiene cuatro campos no negociables:

- `relationType`: uno de `'referente' | 'cliente' | 'proveedor' | 'aliado'` (cerrado en compile-time).
- `score`: número en `[0, 1]` validado en el factory (`Recommendation.create()`).
- `reasons[]`: array de objetos JSONB **estructurados** (no texto libre): `{ feature, weight, value?, confidence? }`.
- `source`: `'ai-inferred' | 'cosine' | 'rule' | 'ecosystem'` — qué matcher la generó.

**Estrategia en cascada (en orden):**

1. **AI (PRINCIPAL) — `AiMatchEngine` con Gemini.** Para cada par `(ciiu_origen, ciiu_destino)` Gemini decide si hay relación de negocio, qué tipo, y con qué confianza. Resultado se cachea estructuralmente en `ai_match_cache`.
2. **Fallback 1 — `PeerMatcher`** (cosine similarity sobre feature vectors): emite recs `'referente'` si cosine ≥ 0.7.
3. **Fallback 2 — `ValueChainMatcher`** (24 reglas hardcoded de cadena de valor): emite recs `'cliente'` o `'proveedor'`.
4. **Fallback 3 — `AllianceMatcher`** (6 ecosistemas predefinidos): emite recs `'aliado'`.

**Fórmula de scoring (matcher AI):**

```
score = ai_confidence × (0.6 + 0.4 × proximity)
```

- `ai_confidence ∈ [0, 1]` — lo que devuelve Gemini para el par CIIU.
- `proximity ∈ [0, 1]` — refinamiento por las dos empresas concretas. Calculado por `ProximityCalculator`:
  - 40% mismo municipio
  - 30% misma etapa (con bonus parcial para etapas adyacentes)
  - 30% similitud log-scale de tamaño (`personal × ingreso`)

**Por qué este split.** El 60% del score es semántico (lo que la AI dice del par CIIU). El 40% modula por proximidad para que dos targets con el mismo par CIIU pero distinta cercanía produzcan scores distintos. Garantía: dos targets nunca empatan al azar.

**Dedupe.** Si AI y un fallback (o dos fallbacks) generan la misma terna `(source, target, type)`, **gana la rec con mayor score**. Las `reasons` son las del matcher ganador (no se mergean).

> **Profundo y a detalle:** la explicación completa del scoring (cada peso, cada threshold, ejemplos numéricos, divergencias con el spec) vive en [`docs/scoring.md`](../../docs/scoring.md).

### 2.4. Agente Conector autónomo

El componente agéntico exigido por el reto. Vive en el bounded context `agent`.

**`AgentScheduler` con `@Cron(env.AGENT_CRON_SCHEDULE)`** (default `*/60 * * * * *`):

1. Crea un `ScanRun` con `trigger: 'cron'`, lo persiste en `scan_runs`.
2. Calcula `since = lastCompletedRun?.completedAt ?? new Date(0)`.
3. **Sync** desde `CompanySource` (CSV/BQ — vía port).
4. Si no hay empresas updated y NO es el primer run → completar scan vacío y salir.
5. Snapshot del estado anterior (`recRepo.snapshotKeys()`, `membershipRepo.snapshot()`).
6. Regenera clusters (`GenerateClusters.execute()`).
7. Regenera recomendaciones (`GenerateRecommendations.execute()`).
8. **Detecta oportunidades** vía `OpportunityDetector` comparando snapshots:
   - `new_high_score_match` → rec con `score >= 0.8` que NO existía antes.
   - `new_value_chain_partner` → rec con `relationType ∈ {cliente, proveedor}` nueva.
   - `new_cluster_member` → empresa que entró a un cluster en el que no estaba.
9. Persiste eventos en `agent_events` (consumibles por el front).
10. Marca `ScanRun.complete(stats)`.

**Concurrencia:** si un scan está corriendo, el siguiente tick lo skippea (no se solapan). `AGENT_ENABLED='false'` apaga el cron sin tocar código. Manual trigger vía `POST /api/agent/scan/trigger` para demos.

---

## 3. Rol de la IA (Gemini)

Esto es lo más importante del documento. La IA no es un "feature opcional" del brain — **es el matcher principal**. Los heurísticos son fallback.

### 3.1. Qué decide la IA

Por cada **par de CIIUs** `(origen, destino)` del universo presente en `companies`, Gemini decide:

- ¿Existe una relación de negocio entre una empresa con CIIU X y una con CIIU Y?
- Si existe, ¿de qué tipo? (`referente`, `cliente`, `proveedor`, `aliado`).
- ¿Con qué confianza? (`[0, 1]`).
- ¿Qué razón corta lo justifica? (string semántico).

Output validado con **Zod schema** dentro de `GeminiAdapter.inferStructured()`. Si Gemini devuelve algo que no parsea como JSON o no cumple el schema, se trata como cache miss y se aplican fallbacks.

### 3.2. Cómo se usa — AI primero + cache estructural

**`ai_match_cache` es estructural, no es una optimización.** Hay ~159 CIIUs reales en el dataset → máximo `159 × 159 ≈ 25k` pares únicos. Pre-evaluar el universo entero contra Gemini al primer arranque y persistir cada resultado en cache es la base del sistema, no un atajo.

**Flujo:**

1. **`CiiuPairEvaluator.evaluateAll()`** corre al primer arranque (o cuando el cache está stale). Para cada par CIIU `(origen, destino)`:
   - Si ya está en cache → skip.
   - Sino → llamar `AiMatchEngine.inferMatch(origen, destino)`, guardar el `AiMatchCacheEntry` con `{ hasMatch, relationType, confidence, reason }`.
2. **`CandidateSelector.selectCandidates(source, all)`** reduce el universo de pares ANTES de generar recs (evita evaluar 10k × 10k = 100M pares en runtime). Reglas:
   - Excluir la propia empresa.
   - Solo empresas cuyo `(source.ciiu, candidate.ciiu)` esté en cache con `hasMatch=true`.
   - Cold start (sin cache aún): mismas división o municipio.
3. **`GenerateRecommendations`** materializa: por cada empresa source, lee del cache, calcula `proximity`, aplica la fórmula de scoring, emite top-N recs con `source: 'ai-inferred'`.

**Costo del primer scan.** ~25k pares × `gemini-2.5-flash` = $1–3 USD según length de prompts. Las siguientes corridas son casi gratis: cache hit en el 99%+ de los casos. Para tests E2E que no quieren tocar Gemini → `AI_MATCH_INFERENCE_ENABLED=false`.

### 3.3. Contexto que recibe Gemini

El prompt **no es un "qué crees vos"**. Recibe contexto de dominio:

- **24 reglas de cadena de valor** hardcoded por la Cámara (ej. supermercado ← productor de carne) vía `ValueChainRules.getRulesAsPromptContext()`.
- **6 ecosistemas predefinidos** (ej. `agro-banano` con miembros CIIU `['0123', '1030', '4630']`) vía `getEcosystemsAsPromptContext()`.
- Pregunta concreta sobre el par CIIU.
- **Schema Zod del output esperado** (Gemini está forzado a devolver JSON validable).

Las reglas hardcoded **NO compiten con la AI** — son su contexto. La AI generaliza más allá de las 24 reglas.

### 3.4. Fallbacks cuando la AI no aplica

Cuando `AI_MATCH_INFERENCE_ENABLED=false`, o cuando Gemini falla, o cuando un par CIIU no tiene cache hit, los tres matchers heurísticos corren en paralelo:

| Matcher             | Tipo de relación que emite | Fórmula                                                | Notas                                         |
| ------------------- | -------------------------- | ------------------------------------------------------ | --------------------------------------------- |
| `PeerMatcher`       | `referente`                | `score = cosine_similarity` (sobre feature vectors)    | Solo si cosine ≥ 0.7                          |
| `ValueChainMatcher` | `cliente` / `proveedor`    | `score = rule.weight × (mismo_municipio ? 1.0 : 0.85)` | Castigo de 15% si distinto municipio          |
| `AllianceMatcher`   | `aliado`                   | `score = mismo_municipio ? 0.75 : 0.55`                | Score plano por presencia en mismo ecosistema |

`FeatureVectorBuilder` construye vectores con: `ciiuDivision` (one-hot), `municipio` (one-hot), `etapa` (one-hot), `personal` log-scale, `ingreso` log-scale.

### 3.5. Lazy enrichment — explicaciones en lenguaje natural

Cuando el usuario hace click en una recomendación en el front, el use case `ExplainRecommendation` ejecuta:

1. Si `recommendation.explanation != null` → devolver cached.
2. Sino → invocar Gemini con contexto (source, target, relationType, reasons) → texto natural.
3. Persistir en `recommendations.explanation` y `explanation_cached_at`.
4. Devolver texto.

**Lazy** porque generar 10k explicaciones por scan sería caro y la mayoría no se ven. **Cached** porque una vez generada, no cambia mientras la rec exista.

### 3.6. Resumen del rol de la IA

| ¿Para qué se usa Gemini?                   | ¿Cuándo?                     | ¿Cacheado en?                 |
| ------------------------------------------ | ---------------------------- | ----------------------------- |
| Inferir match entre par CIIU               | Pre-warm al primer arranque  | `ai_match_cache`              |
| Generar texto natural de la recomendación  | On-demand (click usuario)    | `recommendations.explanation` |
| Enriquecer explicación de cluster (futuro) | On-demand (`ExplainCluster`) | TBD                           |

**No se usa Gemini para:** consultas en runtime sobre la BD, generación de los heurísticos, scoring final, dedupe ni emisión de eventos. Esas son responsabilidades del código TypeScript del brain.

---

## 4. Arquitectura

### 4.1. Hexagonal estricta (Ports & Adapters)

Cada bounded context tiene tres capas. **La regla de dependencia nunca se rompe:**

```
infrastructure → application → domain
```

| Capa              | Qué vive                                                                 | Qué puede importar                                       |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `domain/`         | Entities, value objects, ports (interfaces), domain services             | NADA externo. **TypeScript puro**, ni NestJS ni Supabase |
| `application/`    | Use cases, application services                                          | Solo `domain/`                                           |
| `infrastructure/` | Adapters (Supabase, Gemini, CSV), controllers, modules NestJS, scheduler | `domain/` + `application/`                               |

Los `*.module.ts` de NestJS son **el composition root** — el único lugar donde se cablea qué adapter implementa qué port. Si querés cambiar de Supabase a otra base, o de Gemini a OpenAI, tocás un module y el resto del código no se entera.

Decisión completa en [`docs/specs/00-arquitectura.md` ARQ-001](../../docs/specs/00-arquitectura.md).

### 4.2. BigQuery-readiness vía port `CompanySource`

El reto promete acceso a BigQuery con el dataset real, "en sobre cerrado al inicio del hackathon". Hoy no tenemos credenciales. Trabajamos con el CSV `REGISTRADOS_SII.csv` como mock.

**El port `CompanySource` permite que el día que lleguen las creds, el switch sea esta sola línea en `companies.module.ts`:**

```typescript
{ provide: COMPANY_SOURCE, useClass: CsvCompanySource }      // hoy
{ provide: COMPANY_SOURCE, useClass: BigQueryCompanySource } // mañana
```

Cero impacto en domain, use cases, agent, recommendations, clusters. Esto es lo que el jurado tiene que ver.

### 4.3. Persistencia — Supabase

Todas las tablas operativas viven en Supabase (Postgres administrado) con `service_role` key (escribe + bypassea RLS):

| Bounded context   | Tablas                                                |
| ----------------- | ----------------------------------------------------- |
| `ciiu-taxonomy`   | `ciiu_taxonomy`                                       |
| `companies`       | `companies`                                           |
| `clusters`        | `clusters`, `cluster_members`, `cluster_ciiu_mapping` |
| `recommendations` | `recommendations`, `ai_match_cache`                   |
| `agent`           | `scan_runs`, `agent_events`                           |

Tipos auto-generados via `bun supabase:types` (en el front; el brain lee el archivo vía symlink).

---

## 5. Bounded contexts

Seis contextos, cada uno con su propia carpeta `domain / application / infrastructure` y su propio `*.module.ts`.

```
src/brain/src/
├── shared/                # Ports y adapters cross-cutting (Logger, GeminiPort, SupabaseClient, env, CsvLoader, DataPaths)
├── ciiu-taxonomy/         # Taxonomía oficial DIAN CIIU rev 4 — base de la jerarquía sección/división/grupo
├── companies/             # Empresas (entity + repo + CompanySource port + CsvCompanySource)
├── clusters/              # Generación de clusters (predefinidos + heurísticos en cascada)
├── recommendations/       # Motor AI-first: AiMatchEngine, CandidateSelector, fallbacks, scoring, lazy explain
└── agent/                 # ScanRun, AgentEvent, OpportunityDetector, RunIncrementalScan, AgentScheduler @Cron
```

| Contexto          | Spec                                                                     | Highlight                                                                      |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `shared`          | [`docs/specs/01-shared/`](../../docs/specs/01-shared/)                   | `GeminiPort`, `Logger` port (Console/Null), `SupabaseClient`, `env.ts` con Zod |
| `ciiu-taxonomy`   | [`docs/specs/02-ciiu-taxonomy/`](../../docs/specs/02-ciiu-taxonomy/)     | `findByDivision/findByGrupo` para el clusterer                                 |
| `companies`       | [`docs/specs/03-companies/`](../../docs/specs/03-companies/)             | `CompanySource` port (BQ-ready), `EtapaCalculator`                             |
| `clusters`        | [`docs/specs/04-clusters/`](../../docs/specs/04-clusters/)               | Cascada 2 niveles, una empresa en N clusters                                   |
| `recommendations` | [`docs/specs/05-recommendations/`](../../docs/specs/05-recommendations/) | 18 archivos, AI engine + 3 fallbacks + cache + dedupe + scoring                |
| `agent`           | [`docs/specs/06-agent/`](../../docs/specs/06-agent/)                     | Cron 60s, snapshot diff, eventos `new_high_score_match`, etc.                  |

---

## 6. Flujo end-to-end de un scan

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AgentScheduler @Cron (cada 60s)                     │
└──────────────────────────────────────────┬──────────────────────────────┘
                                           ▼
                            RunIncrementalScan.execute()
                                           │
   ┌───────────────────────────────────────┼───────────────────────────────┐
   │ 1. ScanRun.start() → scan_runs        │                               │
   │ 2. since = lastCompletedRun?.completedAt                              │
   │ 3. SyncCompaniesFromSource ────────► CompanySource.fetchUpdatedSince  │
   │                                         (CsvCompanySource hoy)        │
   │                                         (BigQueryCompanySource mañana)│
   │ 4. Empty diff? → return                                               │
   │ 5. Snapshot prevRecKeys / prevMemberships                             │
   │ 6. GenerateClusters.execute()                                         │
   │      ├── PredefinedClusterMatcher                                     │
   │      └── HeuristicClusterer (división MIN=5 + grupo MIN=10)           │
   │ 7. GenerateRecommendations.execute()                                  │
   │      ├── CiiuPairEvaluator.evaluateAll() ──► Gemini ──► ai_match_cache│
   │      ├── CandidateSelector.selectCandidates()                         │
   │      └── per pair: AiMatch || (Peer + ValueChain + Alliance)          │
   │           └── dedupe by (source, target, type), keep max score        │
   │ 8. OpportunityDetector.detect(new vs prev)                            │
   │      ├── new_high_score_match (score ≥ 0.8 nuevo)                     │
   │      ├── new_value_chain_partner (cliente/proveedor nuevo)            │
   │      └── new_cluster_member (empresa entró a cluster nuevo)           │
   │ 9. AgentEventRepository.saveAll(events)                               │
   │ 10. ScanRun.complete(stats)                                           │
   └───────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
                          Front (SWR poll) → /api/agent/events/:companyId
```

---

## 7. Endpoints REST

OpenAPI auto-generado vía `@nestjs/swagger`. Disponible en `http://localhost:3001/docs` cuando el server está arriba.

> **Postman / Insomnia:** colección importable en [`docs/postman/`](../../docs/postman/) con todas las rutas, variables (`baseUrl`, `companyId`, `clusterId`, `recommendationId`, `eventId`) y ejemplos de body.

### Health

- `GET /api/health` — health check.

### Companies

- `GET /api/companies?limit=50` — lista con DTO sanitizado.
- `GET /api/companies/:id` — detalle (404 si no existe).

### Clusters

- `GET /api/clusters?tipo=...` — lista filtrable.
- `GET /api/clusters/:id` — detalle + miembros.
- `GET /api/clusters/by-company/:companyId` — clusters de una empresa.
- `POST /api/clusters/generate` — dispara `GenerateClusters` (admin).

### Recommendations

- `GET /api/recommendations/by-company/:companyId?type=...&limit=...` — recs ordenadas por score.
- `GET /api/recommendations/:id/explanation` — texto natural lazy (Gemini + cached).
- `POST /api/recommendations/generate` — dispara `GenerateRecommendations` (admin).

### Agent

- `GET /api/agent/events/:companyId?unread=true` — eventos para el usuario.
- `POST /api/agent/events/:eventId/read` — marca como leído.
- `POST /api/agent/scan/trigger` — fuerza un `RunIncrementalScan({ trigger: 'manual' })`.
- `GET /api/agent/scans/recent?limit=10` — últimos runs (observabilidad).

---

## 8. Stack y dependencias clave

| Bloque     | Pieza                                                        | Qué hace                                             |
| ---------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| Framework  | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | DI, controllers, lifecycle                           |
| Cron       | `@nestjs/schedule`                                           | `@Cron(env.AGENT_CRON_SCHEDULE)` para el agente      |
| OpenAPI    | `@nestjs/swagger`                                            | Docs auto-generadas en `/docs`                       |
| IA         | `@google/generative-ai`                                      | Cliente oficial de Gemini (chat + structured output) |
| BD         | `@supabase/postgrest-js`                                     | Cliente liviano (queries directas, sin auth)         |
| CSV        | `papaparse`                                                  | Parsing del dataset Ruta C                           |
| Validación | `zod`, `class-validator`, `class-transformer`                | Schemas de env, DTOs, output de Gemini               |
| Tests      | `vitest`, `@vitest/coverage-v8`, `supertest`                 | Unit + integration. Coverage objetivo > 80%          |

---

## 9. Variables de entorno

Validadas con Zod en `src/shared/infrastructure/env.ts`. **Falla rápido al startup si falta una requerida.**

| Variable                     | Tipo    | Default              | Descripción                                                     |
| ---------------------------- | ------- | -------------------- | --------------------------------------------------------------- |
| `PORT`                       | number  | `3001`               | Puerto HTTP                                                     |
| `SUPABASE_URL`               | url     | — (requerida)        | URL del proyecto Supabase                                       |
| `SUPABASE_SERVICE_ROLE_KEY`  | string  | — (requerida)        | Service role key (escribe + bypass RLS)                         |
| `GEMINI_API_KEY`             | string  | — (requerida)        | API key de Google AI Studio / Vertex                            |
| `GEMINI_CHAT_MODEL`          | string  | `gemini-2.5-flash`   | Modelo para inference + texto natural                           |
| `GEMINI_EMBEDDING_MODEL`     | string  | `text-embedding-004` | Modelo de embeddings (uso futuro)                               |
| `AGENT_CRON_SCHEDULE`        | cron    | `*/60 * * * * *`     | Ritmo del agente (cada 60s por default; bajar a `*/30` en demo) |
| `AGENT_ENABLED`              | enum    | `true`               | `false` apaga el cron sin tocar código                          |
| `AI_MATCH_INFERENCE_ENABLED` | enum    | `true`               | `false` desactiva Gemini → solo fallbacks                       |
| `GCP_PROJECT_ID`             | string? | —                    | Para BigQuery (cuando lleguen creds)                            |
| `GCP_LOCATION`               | string  | `us-central1`        | Región GCP                                                      |
| `BIGQUERY_DATASET`           | string  | `ruta_c`             | Nombre del dataset                                              |
| `DEBUG_ENABLED`              | enum    | `false`              | `true` activa el `ConsoleLogger`; `false` usa `NullLogger`      |

---

## 10. Cómo correr

### Desde la raíz del monorepo

```bash
bun install                       # instala todo el monorepo
cp .env.example .env              # configurar credenciales
bun dev:brain                     # levanta el brain con HMR en :3001
```

### Desde la carpeta del brain

```bash
cd src/brain
bun start:dev                     # dev con watch
bun start:debug                   # dev con --inspect
bun build                         # compila a dist/
bun start:prod                    # corre dist/main
bun test                          # vitest watch
bun test:run                      # vitest single run
bun test:coverage                 # coverage report (>80% objetivo)
bun lint
bun typecheck
```

### Filtrado desde la raíz (sin cambiar de directorio)

```bash
bun --filter brain start:dev
bun --filter brain test:run
bun --filter brain build
```

OpenAPI: `http://localhost:3001/docs` cuando el server está arriba.

---

## 11. Seeds — cargar datos iniciales

Los seeds son scripts independientes en `src/seeds/` que llaman use cases reales (no duplican lógica de mapeo). Son **idempotentes** (upsert por id).

```bash
# Bootstrap todo en orden correcto
bun --filter brain seed

# O paso a paso
bun --filter brain seed:ciiu              # taxonomía DIAN (CIIU_DIAN.csv)
bun --filter brain seed:companies         # empresas (REGISTRADOS_SII.csv)
bun --filter brain seed:clusters          # 8 clusters predefinidos (CLUSTERS.csv)
bun --filter brain seed:cluster-mappings  # mapeo cluster → CIIU
```

Los CSVs viven en [`docs/hackathon/DATA/`](../../docs/hackathon/DATA/) y se acceden vía `DataPaths` (port para que en prod se cambie a otra fuente sin tocar código).

**Nota costo IA:** después de seedear companies + ciiu, el primer arranque del agente disparará `CiiuPairEvaluator.evaluateAll()`, que llena `ai_match_cache` con ~25k pares (~$1–3 USD con `gemini-2.5-flash`). Las siguientes corridas son casi gratis. Para evitarlo en CI/E2E → `AI_MATCH_INFERENCE_ENABLED=false`.

---

## 12. Tests — TDD estricto

`ARQ-007` del repo: **RED → GREEN → REFACTOR**, sin excepciones. Coverage > 80% en `src/`.

- **Domain tests** (Entity, ValueObject): puro unit. Sin mocks.
- **Use case tests:** inyectar `InMemory*Repository`. Sin Supabase ni Gemini.
- **Adapter tests:** mockear el cliente externo (`SupabaseClient`, `GeminiAdapter`), validar mapeo.
- **Controller tests:** `supertest` contra módulo aislado.
- **Stub para Gemini:** `StubGeminiAdapter` para tests del motor sin tocar la AI real.

Estructura de tests refleja la de `src/`:

```
src/brain/__tests__/
├── shared/...
├── ciiu-taxonomy/...
├── companies/...
├── clusters/...
├── recommendations/...
└── agent/...
```

Pre-push hook corre `bun test:run` en todo el monorepo. Si rompe, push rechazado.

---

## 13. Cómo agregar un bounded context nuevo

1. **Domain** (`src/<context>/domain/`): entities, value objects, repository ports, domain services. **Cero imports externos.** Escribir el test de la entity primero.
2. **Application** (`src/<context>/application/`): use cases (TypeScript puro, sin NestJS). Inyectar ports por constructor. Escribir test con `InMemory*Repository`.
3. **Infrastructure** (`src/<context>/infrastructure/`):
   - Adapters de los ports (Supabase, Gemini, gateway HTTP).
   - Controllers (`*.controller.ts`).
   - `*.module.ts` que cablea DI (`{ provide: TOKEN, useClass: ... }`).
4. Importar el módulo en `src/app.module.ts`.
5. Tests en `__tests__/<context>/...` espejando `src/`.
6. Spec en `docs/specs/0X-<context>/requirements.md` y `scenarios.md` siguiendo la plantilla de los existentes.

---

## 14. Convenciones del repo

Ver [`AGENTS.md`](../../AGENTS.md) (raíz) para el detalle. Resumen de lo que aplica al brain:

- **Path aliases:** siempre `@/...` (no `../../...`). El alias `@/*` mapea a `src/brain/src/*`.
- **Logger:** nunca `console.*` directo (ESLint lo prohíbe). Inyectar el `Logger` port.
- **Conventional commits.** `feat | fix | docs | style | refactor | perf | test | chore | ci | revert`. Subject lowercase, sin punto final, ≤ 100 chars.
- **Sin atribución a IA en commits.** Nunca `Co-Authored-By` ni equivalentes.
- **Pre-commit:** lint-staged + commitlint. **Pre-push:** `bun test:run`.

---

## 15. Referencias

- **Plan de implementación:** [`docs/2026-04-25-brain-clustering-engine-implementation.md`](../../docs/2026-04-25-brain-clustering-engine-implementation.md) — 7 fases, ~50 tasks, división Dev A / Dev B.
- **Decisiones cross-cutting:** [`docs/specs/00-arquitectura.md`](../../docs/specs/00-arquitectura.md) — ARQ-001 a ARQ-010.
- **Specs por contexto:** [`docs/specs/`](../../docs/specs/).
- **Reto original:** [`docs/hackathon/`](../../docs/hackathon/) — README, RETO.pdf, dataset.
- **Convenciones del monorepo:** [`AGENTS.md`](../../AGENTS.md).
