# Motor Inteligente de Clusters Empresariales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task with TDD review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el `brain` (NestJS) que (1) carga ~10k empresas reales en Supabase, (2) genera clusters dinámicos basados en taxonomía DIAN, (3) calcula recomendaciones con 4 tipos de relación (referente, cliente, proveedor, aliado) usando 4 capas de matching incluyendo razonamiento con IA, y (4) corre un agente con cron real que detecta oportunidades sin intervención humana.

**Reto cubierto:** Hackathon Samatech "Ruta C Conecta". Solo el `brain`. El front queda para un plan posterior.

**Tech Stack:**

- NestJS 11 + TypeScript + Vitest + Bun
- Supabase (`@supabase/supabase-js`) — persistencia
- `@nestjs/schedule` — cron del agente
- `@google/generative-ai` — Gemini (chat + inference de matches)
- `papaparse` — parseo de CSVs

**Arquitectura:** 5 bounded contexts hexagonales (`ciiu-taxonomy`, `companies`, `clusters`, `recommendations`, `agent`) + `shared`. Domain puro TypeScript, NestJS solo en infrastructure. TDD estricto: failing test → minimal code → commit.

---

## Decisiones arquitectónicas confirmadas

| Decisión                  | Valor                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistencia              | Supabase (tabla por bounded context)                                                                                                                                                                                                                                                                                         |
| Cliente Supabase en brain | `service_role` (escribe + RLS bypass)                                                                                                                                                                                                                                                                                        |
| Cron del agente           | `*/60 * * * * *` (60s, env-configurable)                                                                                                                                                                                                                                                                                     |
| Detección agéntica        | Polling: `companies WHERE updated_at > last_scan_completed_at`                                                                                                                                                                                                                                                               |
| Etapa                     | Derivada en factory: años + personal + ingresos (NO usar `tipoEmpresaTamanoTITULO` — 98.2% NULL)                                                                                                                                                                                                                             |
| Ubicación                 | Solo `municipio` (departamento es 100% NULL)                                                                                                                                                                                                                                                                                 |
| Clusters base             | Heurístico **en cascada de 2 niveles** (NO por sección — muy genérico): (1) **División (2 dig) + municipio** con `MIN=5` empresas → cluster amplio; (2) **Grupo (3 dig) + municipio** con `MIN=10` empresas → cluster de nicho. Una empresa pertenece a AMBOS si aplica (N:M). El umbral mayor en grupo evita microclusters. |
| Clusters predefinidos     | 8 del CSV (BANANO, MANGO, YUCA, CACAO, PALMA, CAFE, LOGISTICA, TURISMO) — capa adicional                                                                                                                                                                                                                                     |
| Matchers                  | **AI primero** (Gemini con rules + ecosystems como guía en el prompt) → cache por par CIIU. Los 3 matchers hardcoded (cosine, rules, ecosystems) quedan como **fallback** cuando AI falla o se desactiva.                                                                                                                    |
| Razones                   | Estructuradas en JSONB (no texto libre); Gemini enriquece bajo demanda con caché en columna                                                                                                                                                                                                                                  |
| AI cache                  | Por par `(ciiu_origen, ciiu_destino)`. **Es la base del sistema, no una excepción.** ~25k pares únicos máximos (159 CIIUs reales × 159)                                                                                                                                                                                      |
| Pre-filtrado              | `CandidateSelector` reduce 10k×10k a pares con CIIU presente en cache antes de generar recs por empresa                                                                                                                                                                                                                      |
| Tabla CIIU DIAN           | Descargada e importada como seed                                                                                                                                                                                                                                                                                             |
| Fuente de empresas        | Port `CompanySource` con adapter `CsvCompanySource` (HOY — sin acceso a BigQuery del reto). El reto provee BQ "en sobre cerrado al inicio del hackathon" — cuando lleguen las creds, se agrega `BigQueryCompanySource` implementando el mismo port, **una línea cambia en el module**. Domain y use cases NO se enteran.     |

---

## Schema de Supabase (DDL completo)

Todo el schema vive en un único archivo de migración. Aplicar via Supabase CLI o SQL editor antes de empezar las tasks de código.

```sql
-- migrations/0001_brain_init.sql

-- =====================================================================
-- 1) CIIU Taxonomy (DIAN)
-- =====================================================================
create table ciiu_taxonomy (
  code            text primary key,             -- '4711' (4 dígitos sin sección)
  seccion         char(1) not null,             -- 'G'
  division        text not null,                -- '47'
  grupo           text not null,                -- '471'
  titulo_actividad text not null,               -- 'Comercio al por menor en establecimientos no especializados con surtido compuesto principalmente por alimentos'
  titulo_seccion  text not null,                -- 'Comercio al por mayor y al por menor'
  titulo_division text not null,                -- 'Comercio al por menor'
  titulo_grupo    text not null,                -- 'Comercio al por menor en establecimientos no especializados'
  macro_sector    text                          -- nullable: 'Servicios', 'Manufacturas', etc. (de los CSV de clusters)
);

create index idx_ciiu_seccion on ciiu_taxonomy(seccion);
create index idx_ciiu_division on ciiu_taxonomy(division);

-- =====================================================================
-- 2) Companies (10k empresas de REGISTRADOS_SII.csv)
-- =====================================================================
create table companies (
  id                 text primary key,           -- registradoMATRICULA (string, hay guiones)
  razon_social       text not null,
  ciiu               text not null,              -- '4711' (sin sección)
  ciiu_seccion       char(1) not null,           -- 'G' (derivado en seed)
  ciiu_division      text not null,              -- '47' (derivado en seed)
  ciiu_grupo         text not null,              -- '471' (derivado en seed: primeros 3 dígitos del ciiu)
  municipio          text not null,
  tipo_organizacion  text,
  personal           int default 0,              -- regitradoPERSONAL (typo oficial)
  ingreso_operacion  numeric(20,2) default 0,
  activos_totales    numeric(20,2) default 0,
  email              text,
  telefono           text,
  direccion          text,
  fecha_matricula    date,
  fecha_renovacion   date,
  estado             text not null default 'ACTIVO',
  etapa              text not null,              -- 'nacimiento' | 'crecimiento' | 'consolidacion' | 'madurez'
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_companies_ciiu on companies(ciiu);
create index idx_companies_ciiu_division on companies(ciiu_division);
create index idx_companies_ciiu_grupo on companies(ciiu_grupo);
create index idx_companies_ciiu_seccion on companies(ciiu_seccion);
create index idx_companies_municipio on companies(municipio);
create index idx_companies_etapa on companies(etapa);
create index idx_companies_updated_at on companies(updated_at);
create index idx_companies_estado on companies(estado);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

-- =====================================================================
-- 3) Clusters
-- =====================================================================
create table clusters (
  id            text primary key,                -- 'pred-7' (predefined) | 'div-47-SANTA_MARTA' | 'grp-477-SANTA_MARTA'
  codigo        text not null,                   -- 'LOGISTICA' | '47-SANTA_MARTA' | '477-SANTA_MARTA'
  titulo        text not null,
  descripcion   text,
  tipo          text not null,                   -- 'predefined' | 'heuristic-division' | 'heuristic-grupo' | 'heuristic-municipio'
  ciiu_division text,                            -- nullable: requerido para heuristic-division y heuristic-grupo
  ciiu_grupo    text,                            -- nullable: requerido SOLO para heuristic-grupo (ej. '477')
  municipio     text,                            -- nullable: para heuristic-municipio
  macro_sector  text,
  member_count  int not null default 0,
  generated_at  timestamptz not null default now()
);

create index idx_clusters_tipo on clusters(tipo);
create index idx_clusters_ciiu_division on clusters(ciiu_division);
create index idx_clusters_ciiu_grupo on clusters(ciiu_grupo);

-- N:M: una empresa puede pertenecer a múltiples clusters (predefinido + heurístico)
create table cluster_members (
  cluster_id  text not null references clusters(id) on delete cascade,
  company_id  text not null references companies(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (cluster_id, company_id)
);

create index idx_cluster_members_company on cluster_members(company_id);

-- Mapeo predefinido: cluster_id (predefined) → CIIU code
-- Cargado desde CLUSTERS_ACTIVIDADESECONOMICAS.csv
create table cluster_ciiu_mapping (
  cluster_id  text not null references clusters(id) on delete cascade,
  ciiu_code   text not null,                     -- '4921' (4 dígitos)
  primary key (cluster_id, ciiu_code)
);

-- =====================================================================
-- 4) Recommendations
-- =====================================================================
create table recommendations (
  id                  uuid primary key default gen_random_uuid(),
  source_company_id   text not null references companies(id) on delete cascade,
  target_company_id   text not null references companies(id) on delete cascade,
  relation_type       text not null,             -- 'referente' | 'cliente' | 'proveedor' | 'aliado'
  score               numeric(5,4) not null check (score >= 0 and score <= 1),
  reasons             jsonb not null default '[]'::jsonb,
                                                -- [{ feature: 'mismo_ciiu_division', weight: 0.3, value: '47' }, ...]
  source              text not null,             -- 'rule' | 'cosine' | 'ecosystem' | 'ai-inferred'
  explanation         text,                      -- Gemini enriched, lazy + cached
  explanation_cached_at timestamptz,
  created_at          timestamptz not null default now(),
  unique (source_company_id, target_company_id, relation_type),
  check (source_company_id <> target_company_id)
);

create index idx_recommendations_source on recommendations(source_company_id, score desc);
create index idx_recommendations_target on recommendations(target_company_id);
create index idx_recommendations_type on recommendations(relation_type);

-- Caché de inferencia de IA por par de CIIUs (no de empresas)
create table ai_match_cache (
  ciiu_origen   text not null,
  ciiu_destino  text not null,
  has_match     boolean not null,
  relation_type text,                            -- nullable si has_match = false
  confidence    numeric(5,4),
  reason        text,
  cached_at     timestamptz not null default now(),
  primary key (ciiu_origen, ciiu_destino)
);

-- =====================================================================
-- 5) Agent Scan Runs + Events
-- =====================================================================
create table scan_runs (
  id                       uuid primary key default gen_random_uuid(),
  started_at               timestamptz not null default now(),
  completed_at             timestamptz,
  companies_scanned        int not null default 0,
  clusters_generated       int not null default 0,
  recommendations_generated int not null default 0,
  events_emitted           int not null default 0,
  status                   text not null,        -- 'running' | 'completed' | 'failed' | 'partial'
  trigger                  text not null,        -- 'cron' | 'manual'
  error_message            text,
  duration_ms              int
);

create index idx_scan_runs_started on scan_runs(started_at desc);
create index idx_scan_runs_status on scan_runs(status);

create table agent_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null references companies(id) on delete cascade,
  event_type  text not null,                    -- 'new_high_score_match' | 'new_value_chain_partner' | 'new_cluster_member'
  payload     jsonb not null,                   -- detalles del evento
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_agent_events_company on agent_events(company_id, created_at desc);
create index idx_agent_events_unread on agent_events(company_id) where read = false;
```

---

## File Structure (nuevos archivos)

### Shared (8 archivos)

- `src/brain/src/shared/infrastructure/supabase/SupabaseClient.ts` — Factory NestJS provider
- `src/brain/src/shared/infrastructure/supabase/database.types.ts` — Auto-generado por `bun supabase:types` (post-schema)
- `src/brain/src/shared/infrastructure/csv/CsvLoader.ts` — Parser papaparse
- `src/brain/src/shared/infrastructure/path/DataPaths.ts` — Path resolution robusto (no asume cwd)
- `src/brain/src/shared/domain/GeminiPort.ts` — Port: `generateText(prompt)` + `inferStructured<T>(prompt, schema)`
- `src/brain/src/shared/infrastructure/gemini/GeminiAdapter.ts` — Adapter real
- `src/brain/src/shared/infrastructure/gemini/StubGeminiAdapter.ts` — Stub para tests
- `src/brain/src/shared/shared.module.ts` — Exports compartidos

### CIIU Taxonomy Context (5 archivos)

- `src/brain/src/ciiu-taxonomy/domain/entities/CiiuActivity.ts`
- `src/brain/src/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository.ts`
- `src/brain/src/ciiu-taxonomy/application/use-cases/FindCiiuByCode.ts`
- `src/brain/src/ciiu-taxonomy/infrastructure/repositories/SupabaseCiiuTaxonomyRepository.ts`
- `src/brain/src/ciiu-taxonomy/ciiu-taxonomy.module.ts`

### Companies Context (13 archivos)

- `src/brain/src/companies/domain/value-objects/Etapa.ts`
- `src/brain/src/companies/domain/services/EtapaCalculator.ts`
- `src/brain/src/companies/domain/entities/Company.ts`
- `src/brain/src/companies/domain/repositories/CompanyRepository.ts`
- `src/brain/src/companies/domain/sources/CompanySource.ts` — **PORT** read-only para fuente externa (CSV hoy, BigQuery cuando lleguen las creds del reto)
- `src/brain/src/companies/application/use-cases/GetCompanies.ts`
- `src/brain/src/companies/application/use-cases/FindCompanyById.ts`
- `src/brain/src/companies/application/use-cases/GetCompaniesUpdatedSince.ts`
- `src/brain/src/companies/application/use-cases/SyncCompaniesFromSource.ts` — orquesta `CompanySource.fetchAll()` → `CompanyRepository.saveMany()`
- `src/brain/src/companies/infrastructure/sources/CsvCompanySource.ts` — **ADAPTER** que lee `REGISTRADOS_SII.csv` (mock del dataset BQ del reto)
- `src/brain/src/companies/infrastructure/repositories/SupabaseCompanyRepository.ts`
- `src/brain/src/companies/infrastructure/repositories/InMemoryCompanyRepository.ts`
- `src/brain/src/companies/infrastructure/http/companies.controller.ts`
- `src/brain/src/companies/companies.module.ts`

### Clusters Context (13 archivos)

- `src/brain/src/clusters/domain/entities/Cluster.ts`
- `src/brain/src/clusters/domain/value-objects/ClusterType.ts`
- `src/brain/src/clusters/domain/repositories/ClusterRepository.ts`
- `src/brain/src/clusters/domain/repositories/ClusterMembershipRepository.ts`
- `src/brain/src/clusters/domain/repositories/ClusterCiiuMappingRepository.ts`
- `src/brain/src/clusters/application/services/HeuristicClusterer.ts`
- `src/brain/src/clusters/application/services/PredefinedClusterMatcher.ts`
- `src/brain/src/clusters/application/use-cases/GenerateClusters.ts`
- `src/brain/src/clusters/application/use-cases/GetCompanyClusters.ts`
- `src/brain/src/clusters/application/use-cases/ExplainCluster.ts`
- `src/brain/src/clusters/infrastructure/repositories/SupabaseClusterRepository.ts`
- `src/brain/src/clusters/infrastructure/repositories/SupabaseClusterMembershipRepository.ts`
- `src/brain/src/clusters/infrastructure/repositories/SupabaseClusterCiiuMappingRepository.ts`
- `src/brain/src/clusters/infrastructure/repositories/InMemoryClusterRepository.ts`
- `src/brain/src/clusters/infrastructure/http/clusters.controller.ts`
- `src/brain/src/clusters/clusters.module.ts`

### Recommendations Context (18 archivos — el corazón del motor)

- `src/brain/src/recommendations/domain/value-objects/RelationType.ts`
- `src/brain/src/recommendations/domain/value-objects/Reason.ts`
- `src/brain/src/recommendations/domain/entities/Recommendation.ts`
- `src/brain/src/recommendations/domain/entities/AiMatchCacheEntry.ts`
- `src/brain/src/recommendations/domain/repositories/RecommendationRepository.ts`
- `src/brain/src/recommendations/domain/repositories/AiMatchCacheRepository.ts`
- `src/brain/src/recommendations/application/services/ValueChainRules.ts` — registry estático: 24 reglas + 6 ecosistemas (usados como CONTEXTO en prompts AI Y como fallback)
- `src/brain/src/recommendations/application/services/AiMatchEngine.ts` — **MATCHER PRINCIPAL**: Gemini con rules+ecosystems en el prompt
- `src/brain/src/recommendations/application/services/CandidateSelector.ts` — pre-filtrado para no evaluar O(n²) pares
- `src/brain/src/recommendations/application/services/CiiuPairEvaluator.ts` — orquesta evaluación de TODOS los pares CIIU del universo, llena el cache
- `src/brain/src/recommendations/application/services/FeatureVectorBuilder.ts` — usado en proximity boost + fallback
- `src/brain/src/recommendations/application/services/PeerMatcher.ts` — **fallback** capa cosine
- `src/brain/src/recommendations/application/services/ValueChainMatcher.ts` — **fallback** rules-based
- `src/brain/src/recommendations/application/services/AllianceMatcher.ts` — **fallback** ecosistemas
- `src/brain/src/recommendations/application/use-cases/GenerateRecommendations.ts` — AI-first con fallback
- `src/brain/src/recommendations/application/use-cases/GetCompanyRecommendations.ts`
- `src/brain/src/recommendations/application/use-cases/ExplainRecommendation.ts` — Gemini enrichment lazy + caché
- `src/brain/src/recommendations/infrastructure/repositories/SupabaseRecommendationRepository.ts`
- `src/brain/src/recommendations/infrastructure/repositories/SupabaseAiMatchCacheRepository.ts`
- `src/brain/src/recommendations/infrastructure/repositories/InMemoryRecommendationRepository.ts`
- `src/brain/src/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository.ts`
- `src/brain/src/recommendations/infrastructure/http/recommendations.controller.ts`
- `src/brain/src/recommendations/recommendations.module.ts`

### Agent Context (12 archivos)

- `src/brain/src/agent/domain/entities/ScanRun.ts`
- `src/brain/src/agent/domain/entities/AgentEvent.ts`
- `src/brain/src/agent/domain/value-objects/EventType.ts`
- `src/brain/src/agent/domain/repositories/ScanRunRepository.ts`
- `src/brain/src/agent/domain/repositories/AgentEventRepository.ts`
- `src/brain/src/agent/application/services/OpportunityDetector.ts`
- `src/brain/src/agent/application/use-cases/RunIncrementalScan.ts`
- `src/brain/src/agent/application/use-cases/GetAgentEvents.ts`
- `src/brain/src/agent/application/use-cases/MarkEventAsRead.ts`
- `src/brain/src/agent/infrastructure/repositories/SupabaseScanRunRepository.ts`
- `src/brain/src/agent/infrastructure/repositories/SupabaseAgentEventRepository.ts`
- `src/brain/src/agent/infrastructure/scheduler/AgentScheduler.ts` — `@Cron` decorator
- `src/brain/src/agent/infrastructure/http/agent.controller.ts`
- `src/brain/src/agent/agent.module.ts`

### Seeds (5 archivos)

- `src/brain/src/seeds/seed-ciiu-taxonomy.ts`
- `src/brain/src/seeds/seed-predefined-clusters.ts`
- `src/brain/src/seeds/seed-cluster-mappings.ts`
- `src/brain/src/seeds/seed-companies.ts`
- `src/brain/src/seeds/bootstrap-all.ts` — runner

### Tests (espejo de src/, ~40 archivos)

```
__tests__/
├── shared/
│   ├── infrastructure/csv/CsvLoader.test.ts
│   ├── infrastructure/gemini/GeminiAdapter.test.ts
│   └── infrastructure/path/DataPaths.test.ts
├── ciiu-taxonomy/
│   ├── CiiuActivity.test.ts
│   └── FindCiiuByCode.test.ts
├── companies/
│   ├── EtapaCalculator.test.ts
│   ├── Company.test.ts
│   ├── GetCompanies.test.ts
│   ├── FindCompanyById.test.ts
│   ├── GetCompaniesUpdatedSince.test.ts
│   ├── SyncCompaniesFromSource.test.ts
│   ├── CsvCompanySource.test.ts
│   └── SupabaseCompanyRepository.test.ts
├── clusters/
│   ├── Cluster.test.ts
│   ├── HeuristicClusterer.test.ts
│   ├── PredefinedClusterMatcher.test.ts
│   ├── GenerateClusters.test.ts
│   └── ExplainCluster.test.ts
├── recommendations/
│   ├── RelationType.test.ts
│   ├── Reason.test.ts
│   ├── Recommendation.test.ts
│   ├── FeatureVectorBuilder.test.ts
│   ├── PeerMatcher.test.ts
│   ├── ValueChainRules.test.ts
│   ├── ValueChainMatcher.test.ts
│   ├── AllianceMatcher.test.ts
│   ├── AiMatchInferer.test.ts
│   ├── GenerateRecommendations.test.ts
│   ├── GetCompanyRecommendations.test.ts
│   └── ExplainRecommendation.test.ts
├── agent/
│   ├── ScanRun.test.ts
│   ├── AgentEvent.test.ts
│   ├── OpportunityDetector.test.ts
│   ├── RunIncrementalScan.test.ts
│   └── AgentScheduler.test.ts
└── fixtures/
    ├── companies.ts        — 20 empresas reales (sacadas del análisis)
    ├── ciiu-taxonomy.ts    — top 30 CIIUs
    └── clusters.ts
```

---

## Tabla de dependencias entre fases

```
Phase 0 (deps + env + schema)
    ↓
Phase 1 (shared infra)
    ↓
Phase 2 (CIIU taxonomy) ←──── Seed CIIU DIAN (Task 7.1)
    ↓
Phase 3 (Companies)     ←──── Seed Companies (Task 7.4)
    ↓
Phase 4 (Clusters)      ←──── Seed Clusters (Tasks 7.2, 7.3)
    ↓
Phase 5 (Recommendations) ←── usa Phase 3 + 4
    ↓
Phase 6 (Agent)         ←──── usa Phase 3 + 4 + 5
    ↓
Phase 7 (Wiring + E2E)
```

**Paralelización posible:** Phase 4 y Phase 5 pueden ir en paralelo después de Phase 3. Phase 7 es secuencial.

---

# Phase 0 — Pre-requisites & Infrastructure

## Task 0.1 — Agregar dependencias al brain

**Archivos:** `src/brain/package.json`

- [ ] **Step 1**: Instalar dependencias

```bash
cd src/brain && bun add @supabase/supabase-js @nestjs/schedule papaparse @google/generative-ai
cd src/brain && bun add -d @types/papaparse
```

- [ ] **Step 2**: Verificar `package.json` tiene las nuevas deps

- [ ] **Step 3**: Commit

```bash
git add src/brain/package.json bun.lock
git commit -m "chore(brain): add supabase, schedule, papaparse, gemini deps"
```

---

## Task 0.2 — Actualizar `env.ts` del brain con Supabase + Agent

**Archivos:** `src/brain/src/shared/infrastructure/env.ts`

- [ ] **Step 1**: Agregar variables al schema Zod existente

```typescript
export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),

  // Supabase (NUEVO)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Agent (NUEVO)
  AGENT_CRON_SCHEDULE: z.string().min(1).default('*/60 * * * * *'),
  AGENT_ENABLED: z.enum(['true', 'false']).default('true'),
  AI_MATCH_INFERENCE_ENABLED: z.enum(['true', 'false']).default('true'),

  // Gemini (ya existían — solo confirmar)
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_CHAT_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-004'),

  // Resto existente
  GCP_PROJECT_ID: z.string().min(1).optional(),
  GCP_LOCATION: z.string().min(1).default('us-central1'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  BIGQUERY_DATASET: z.string().min(1).default('ruta_c'),
  DEBUG_ENABLED: z.enum(['true', 'false']).optional().default('false'),
})
```

Nota: `GEMINI_API_KEY` pasa de `optional()` a obligatorio (ahora lo necesitamos sí o sí).

- [ ] **Step 2**: Pedirle al user que actualice `.env` raíz con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`. Usuario lo hace manual (dijo que él coloca las envs).

- [ ] **Step 3**: Verificar que el server arranca sin errores: `bun --filter brain start:dev`

- [ ] **Step 4**: Commit

```bash
git add src/brain/src/shared/infrastructure/env.ts
git commit -m "chore(brain): add supabase + agent env vars"
```

---

## Task 0.3 — Aplicar el schema de Supabase

**Archivos:** `supabase/migrations/0001_brain_init.sql` (nuevo)

- [ ] **Step 1**: Crear archivo de migración con el SQL completo de la sección "Schema de Supabase" arriba.

- [ ] **Step 2**: Aplicar la migración. Dos opciones:

**Opción A** (Supabase CLI, recomendada):

```bash
bunx supabase db push
```

**Opción B** (manual via Dashboard):

1. Ir a Supabase Dashboard → SQL Editor
2. Pegar el contenido de `0001_brain_init.sql`
3. Ejecutar

- [ ] **Step 3**: Regenerar tipos TypeScript

```bash
bun supabase:types
```

Verificar que `src/front/core/shared/infrastructure/supabase/database.types.ts` ahora incluye las tablas nuevas.

- [ ] **Step 4**: Copiar/symlink los types al brain

```bash
cd src/brain/src/shared/infrastructure/supabase
ln -sf ../../../../../../front/core/shared/infrastructure/supabase/database.types.ts database.types.ts
```

(Compartir types entre workspaces para no duplicar; si el symlink molesta a TypeScript, copiar manualmente.)

- [ ] **Step 5**: Commit

```bash
git add supabase/migrations/0001_brain_init.sql src/brain/src/shared/infrastructure/supabase/database.types.ts
git commit -m "feat(db): add initial brain schema with 8 tables and indexes"
```

---

## Task 0.4 — Descargar tabla CIIU DIAN

**Archivos:** `docs/hackathon/DATA/CIIU_DIAN.csv` (nuevo, ~700 filas)

La taxonomía oficial DIAN CIIU rev 4 está en formato XLS/CSV. Tres opciones de origen:

1. **DANE oficial**: https://www.dane.gov.co/files/sen/nomenclatura/ciiu/CIIU_Rev_4_AC.xlsx (convertir a CSV)
2. **DIAN UVT**: catálogo dentro del MUISCA
3. **Snapshot anonimizado**: si no tenemos acceso, usar lo que ya tenemos en `CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv` que tiene 28 actividades + complementar con scraping del DANE

- [ ] **Step 1**: Descargar el archivo oficial DANE en XLSX

- [ ] **Step 2**: Convertir a CSV con headers: `code,seccion,division,grupo,titulo_actividad,titulo_seccion,titulo_division,titulo_grupo,macro_sector`

Formato esperado de cada fila:

```
4711,G,47,471,"Comercio al por menor en establecimientos no especializados con surtido compuesto principalmente por alimentos","Comercio al por mayor y al por menor","Comercio al por menor","Comercio al por menor en establecimientos no especializados",Servicios
```

- [ ] **Step 3**: Guardar en `docs/hackathon/DATA/CIIU_DIAN.csv`

- [ ] **Step 4**: Verificar que tiene al menos los 28 CIIUs que ya están en `CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv`

- [ ] **Step 5**: Commit

```bash
git add docs/hackathon/DATA/CIIU_DIAN.csv
git commit -m "data: add DIAN CIIU rev 4 taxonomy CSV"
```

---

# Phase 1 — Shared Infrastructure

## Task 1.1 — `DataPaths` utility

**Archivos:**

- Crear: `src/brain/src/shared/infrastructure/path/DataPaths.ts`
- Crear: `__tests__/shared/infrastructure/path/DataPaths.test.ts`

- [ ] **Step 1 (RED)**: Test failing

```typescript
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'
import { describe, it, expect } from 'vitest'
import fs from 'fs'

describe('DataPaths', () => {
  it('resolves CSV paths regardless of cwd', () => {
    expect(fs.existsSync(DataPaths.companiesCsv)).toBe(true)
    expect(fs.existsSync(DataPaths.clustersCsv)).toBe(true)
    expect(fs.existsSync(DataPaths.ciiuDianCsv)).toBe(true)
  })

  it('exposes all 6 expected paths', () => {
    expect(DataPaths).toMatchObject({
      ciiuDianCsv: expect.stringContaining('CIIU_DIAN.csv'),
      companiesCsv: expect.stringContaining('REGISTRADOS_SII.csv'),
      clustersCsv: expect.stringContaining('CLUSTERS.csv'),
      clusterActivitiesCsv: expect.stringContaining(
        'CLUSTERS_ACTIVIDADESECONOMICAS.csv',
      ),
      clusterSectoresCsv: expect.stringContaining(
        'CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv',
      ),
      clusterMembersCsv: expect.stringContaining(
        'CLUSTERS_POSIBLES_MIEMBROS_POR_ACTIVIDAD_PRINCIPAL_DATOS.csv',
      ),
    })
  })
})
```

- [ ] **Step 2 (GREEN)**: Implementar

```typescript
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolución robusta: anclar al directorio del archivo, NO al cwd.
// Subir desde src/brain/src/shared/infrastructure/path/ hasta el repo root.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../../../../../')
const DATA_DIR = path.join(REPO_ROOT, 'docs/hackathon/DATA')

export const DataPaths = {
  ciiuDianCsv: path.join(DATA_DIR, 'CIIU_DIAN.csv'),
  companiesCsv: path.join(DATA_DIR, 'REGISTRADOS_SII.csv'),
  clustersCsv: path.join(DATA_DIR, 'CLUSTERS.csv'),
  clusterActivitiesCsv: path.join(
    DATA_DIR,
    'CLUSTERS_ACTIVIDADESECONOMICAS.csv',
  ),
  clusterSectoresCsv: path.join(
    DATA_DIR,
    'CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv',
  ),
  clusterMembersCsv: path.join(
    DATA_DIR,
    'CLUSTERS_POSIBLES_MIEMBROS_POR_ACTIVIDAD_PRINCIPAL_DATOS.csv',
  ),
} as const
```

Nota: si NestJS compila a CJS, `import.meta.url` no funciona. Fallback:

```typescript
const REPO_ROOT = path.resolve(__dirname, '../../../../../../')
```

(`__dirname` está disponible en CJS automáticamente)

- [ ] **Step 3**: `bun --filter brain test:run -- DataPaths` → PASS

- [ ] **Step 4**: Commit

```bash
git add src/brain/src/shared/infrastructure/path/DataPaths.ts __tests__/shared/infrastructure/path/DataPaths.test.ts
git commit -m "feat(shared): add DataPaths utility with anchor-based resolution"
```

---

## Task 1.2 — `CsvLoader` utility

**Archivos:**

- Crear: `src/brain/src/shared/infrastructure/csv/CsvLoader.ts`
- Crear: `__tests__/shared/infrastructure/csv/CsvLoader.test.ts`

- [ ] **Step 1 (RED)**: Test con CSV real (REGISTRADOS_SII.csv) — verificar headers y row count

```typescript
import { CsvLoader } from '@/shared/infrastructure/csv/CsvLoader'
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'
import { describe, it, expect } from 'vitest'

describe('CsvLoader', () => {
  it('loads REGISTRADOS_SII.csv and returns 10000 rows', async () => {
    const rows = await CsvLoader.load(DataPaths.companiesCsv)
    expect(rows.length).toBeGreaterThanOrEqual(9000)
    expect(rows[0]).toHaveProperty('registradoMATRICULA')
    expect(rows[0]).toHaveProperty('registradosCIIU1_CODIGOSII')
  })

  it('handles UTF-8 with quoted commas correctly', async () => {
    const rows = await CsvLoader.load(DataPaths.clusterMembersCsv)
    expect(rows.length).toBeGreaterThan(0)
    // El CSV tiene "AGRICULTURA, GANADERÍA, CAZA..." entre comillas
    const agroRow = rows.find(
      (r: any) =>
        typeof r.ciiuSeccionTITULO === 'string' &&
        r.ciiuSeccionTITULO.includes('AGRICULTURA'),
    )
    expect(agroRow).toBeDefined()
  })

  it('applies optional row mapper', async () => {
    type Mapped = { id: string; razon: string }
    const rows = await CsvLoader.load<Mapped>(
      DataPaths.companiesCsv,
      (row: any) => ({
        id: row.registradoMATRICULA,
        razon: row.registradoRAZONSOCIAL,
      }),
    )
    expect(rows[0].id).toBeTruthy()
    expect(rows[0].razon).toBeTruthy()
  })
})
```

- [ ] **Step 2 (GREEN)**: Implementar usando papaparse

```typescript
import fs from 'node:fs/promises'
import Papa from 'papaparse'

export class CsvLoader {
  static async load<T = Record<string, string>>(
    filePath: string,
    rowMapper?: (row: Record<string, string>) => T,
  ): Promise<T[]> {
    const content = await fs.readFile(filePath, 'utf-8')
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (result.errors.length > 0) {
      const fatal = result.errors.filter(
        (e) => e.type === 'Quotes' || e.type === 'Delimiter',
      )
      if (fatal.length > 0) {
        throw new Error(
          `CSV parse errors in ${filePath}: ${JSON.stringify(fatal.slice(0, 3))}`,
        )
      }
    }

    return rowMapper
      ? result.data.map(rowMapper)
      : (result.data as unknown as T[])
  }
}
```

- [ ] **Step 3**: Test → PASS

- [ ] **Step 4**: Commit

```bash
git add src/brain/src/shared/infrastructure/csv/CsvLoader.ts __tests__/shared/infrastructure/csv/CsvLoader.test.ts
git commit -m "feat(shared): add CsvLoader with papaparse"
```

---

## Task 1.3 — `GeminiPort` + `GeminiAdapter`

**Archivos:**

- Crear: `src/brain/src/shared/domain/GeminiPort.ts`
- Crear: `src/brain/src/shared/infrastructure/gemini/GeminiAdapter.ts`
- Crear: `src/brain/src/shared/infrastructure/gemini/StubGeminiAdapter.ts`
- Crear: `__tests__/shared/infrastructure/gemini/GeminiAdapter.test.ts`

- [ ] **Step 1**: Definir el port

```typescript
// GeminiPort.ts
export interface GeminiPort {
  /**
   * Genera texto libre. Para enriquecer explicaciones de clusters/recomendaciones.
   */
  generateText(prompt: string): Promise<string>

  /**
   * Pide a Gemini que devuelva JSON estructurado siguiendo un esquema.
   * Usa el schema en el prompt; valida en runtime el JSON retornado.
   * Si Gemini devuelve algo no parseable, lanza error.
   */
  inferStructured<T>(prompt: string, validate: (raw: unknown) => T): Promise<T>
}
```

- [ ] **Step 2 (RED)**: Test del adapter usando el modelo real (skippable si no hay API key en CI)

```typescript
import { GeminiAdapter } from '@/shared/infrastructure/gemini/GeminiAdapter'
import { describe, it, expect } from 'vitest'

const hasKey = !!process.env.GEMINI_API_KEY

describe.skipIf(!hasKey)('GeminiAdapter (real API)', () => {
  it('generateText returns non-empty string', async () => {
    const adapter = new GeminiAdapter()
    const out = await adapter.generateText('Di "hola" en una palabra')
    expect(out.toLowerCase()).toContain('hola')
  }, 30_000)

  it('inferStructured parses JSON', async () => {
    const adapter = new GeminiAdapter()
    const out = await adapter.inferStructured(
      'Devuelve JSON con la forma { "ok": true }. Solo el JSON, sin prosa.',
      (raw) => {
        if (typeof raw !== 'object' || raw === null || !('ok' in raw)) {
          throw new Error('invalid')
        }
        return raw as { ok: boolean }
      },
    )
    expect(out.ok).toBe(true)
  }, 30_000)
})
```

- [ ] **Step 3 (GREEN)**: Implementar `GeminiAdapter`

````typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GeminiPort } from '@/shared/domain/GeminiPort'
import { env } from '@/shared/infrastructure/env'

export class GeminiAdapter implements GeminiPort {
  private readonly client: GoogleGenerativeAI
  private readonly modelName: string

  constructor() {
    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY)
    this.modelName = env.GEMINI_CHAT_MODEL
  }

  async generateText(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.modelName })
    const result = await model.generateContent(prompt)
    return result.response.text()
  }

  async inferStructured<T>(
    prompt: string,
    validate: (raw: unknown) => T,
  ): Promise<T> {
    const raw = await this.generateText(prompt)
    // Gemini a veces envuelve en ```json ... ```
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch (e) {
      throw new Error(`Gemini returned non-JSON: ${cleaned.slice(0, 200)}`)
    }
    return validate(parsed)
  }
}
````

- [ ] **Step 4**: Implementar `StubGeminiAdapter` para tests

```typescript
import { GeminiPort } from '@/shared/domain/GeminiPort'

export class StubGeminiAdapter implements GeminiPort {
  constructor(
    private readonly textResponse: string = 'stub response',
    private readonly structuredResponse: unknown = {},
  ) {}

  async generateText(_prompt: string): Promise<string> {
    return this.textResponse
  }

  async inferStructured<T>(
    _prompt: string,
    validate: (raw: unknown) => T,
  ): Promise<T> {
    return validate(this.structuredResponse)
  }
}
```

- [ ] **Step 5**: Tests → PASS (los real-API se saltan si no hay key)

- [ ] **Step 6**: Commit

```bash
git add src/brain/src/shared/domain/GeminiPort.ts src/brain/src/shared/infrastructure/gemini/ __tests__/shared/infrastructure/gemini/
git commit -m "feat(shared): add GeminiPort with real adapter and test stub"
```

---

## Task 1.4 — `SupabaseClient` factory

**Archivos:**

- Crear: `src/brain/src/shared/infrastructure/supabase/SupabaseClient.ts`

- [ ] **Step 1**: Implementar factory + token DI

```typescript
import { Provider } from '@nestjs/common'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/shared/infrastructure/env'
import type { Database } from './database.types'

export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT')

export type BrainSupabaseClient = SupabaseClient<Database>

export function createBrainSupabaseClient(): BrainSupabaseClient {
  return createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export const SupabaseClientProvider: Provider = {
  provide: SUPABASE_CLIENT,
  useFactory: () => createBrainSupabaseClient(),
}
```

- [ ] **Step 2**: No test unitario (es un factory thin) — se cubre integración cuando los repositorios lo usen.

- [ ] **Step 3**: Commit

```bash
git add src/brain/src/shared/infrastructure/supabase/SupabaseClient.ts
git commit -m "feat(shared): add Supabase client factory with service role key"
```

---

## Task 1.5 — `SharedModule`

**Archivos:**

- Crear: `src/brain/src/shared/shared.module.ts`

- [ ] **Step 1**: Crear módulo que expone Supabase + Gemini

```typescript
import { Global, Module } from '@nestjs/common'
import {
  SupabaseClientProvider,
  SUPABASE_CLIENT,
} from './infrastructure/supabase/SupabaseClient'
import { GeminiAdapter } from './infrastructure/gemini/GeminiAdapter'

export const GEMINI_PORT = Symbol('GEMINI_PORT')

@Global()
@Module({
  providers: [
    SupabaseClientProvider,
    { provide: GEMINI_PORT, useClass: GeminiAdapter },
  ],
  exports: [SUPABASE_CLIENT, GEMINI_PORT],
})
export class SharedModule {}
```

- [ ] **Step 2**: Importar `SharedModule` en `app.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SharedModule } from './shared/shared.module'
import { HealthController } from './shared/infrastructure/health/health.controller'

@Module({
  imports: [ScheduleModule.forRoot(), SharedModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 3**: `bun --filter brain start:dev` debe arrancar sin errores. Verificar `GET /api/health` responde.

- [ ] **Step 4**: Commit

```bash
git add src/brain/src/shared/shared.module.ts src/brain/src/app.module.ts
git commit -m "feat(brain): wire shared module with Supabase + Gemini global providers"
```

---

# Phase 2 — CIIU Taxonomy Context

## Task 2.1 — `CiiuActivity` entity

**Archivos:**

- Crear: `src/brain/src/ciiu-taxonomy/domain/entities/CiiuActivity.ts`
- Crear: `__tests__/ciiu-taxonomy/CiiuActivity.test.ts`

- [ ] **Step 1 (RED)**: Test factory + invariantes

```typescript
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'

describe('CiiuActivity', () => {
  it('creates a valid activity', () => {
    const a = CiiuActivity.create({
      code: '4711',
      titulo: 'Comercio al por menor en establecimientos no especializados',
      seccion: 'G',
      division: '47',
      grupo: '471',
      tituloSeccion: 'Comercio',
      tituloDivision: 'Comercio al por menor',
      tituloGrupo: 'Establecimientos no especializados',
      macroSector: 'Servicios',
    })
    expect(a.code).toBe('4711')
    expect(a.seccion).toBe('G')
  })

  it('throws when code is not 4 digits', () => {
    expect(() => CiiuActivity.create({ code: '47' /* ... */ } as any)).toThrow()
  })

  it('throws when seccion is not a single uppercase letter', () => {
    expect(() =>
      CiiuActivity.create({ code: '4711', seccion: 'XX' /* ... */ } as any),
    ).toThrow()
  })
})
```

- [ ] **Step 2 (GREEN)**: Implementar

```typescript
import { Entity } from '@/shared/domain/Entity'

interface CiiuActivityProps {
  titulo: string
  seccion: string
  division: string
  grupo: string
  tituloSeccion: string
  tituloDivision: string
  tituloGrupo: string
  macroSector: string | null
}

export class CiiuActivity extends Entity<string> {
  private readonly props: CiiuActivityProps

  private constructor(code: string, props: CiiuActivityProps) {
    super(code)
    this.props = Object.freeze(props)
  }

  static create(data: {
    code: string
    titulo: string
    seccion: string
    division: string
    grupo: string
    tituloSeccion: string
    tituloDivision: string
    tituloGrupo: string
    macroSector?: string | null
  }): CiiuActivity {
    if (!/^\d{4}$/.test(data.code)) {
      throw new Error(`CIIU code must be 4 digits, got: ${data.code}`)
    }
    if (!/^[A-Z]$/.test(data.seccion)) {
      throw new Error(
        `CIIU seccion must be a single uppercase letter, got: ${data.seccion}`,
      )
    }
    if (!/^\d{2}$/.test(data.division)) {
      throw new Error(`CIIU division must be 2 digits, got: ${data.division}`)
    }

    return new CiiuActivity(data.code, {
      titulo: data.titulo,
      seccion: data.seccion,
      division: data.division,
      grupo: data.grupo,
      tituloSeccion: data.tituloSeccion,
      tituloDivision: data.tituloDivision,
      tituloGrupo: data.tituloGrupo,
      macroSector: data.macroSector ?? null,
    })
  }

  get code(): string {
    return this._id
  }
  get titulo(): string {
    return this.props.titulo
  }
  get seccion(): string {
    return this.props.seccion
  }
  get division(): string {
    return this.props.division
  }
  get grupo(): string {
    return this.props.grupo
  }
  get tituloSeccion(): string {
    return this.props.tituloSeccion
  }
  get tituloDivision(): string {
    return this.props.tituloDivision
  }
  get tituloGrupo(): string {
    return this.props.tituloGrupo
  }
  get macroSector(): string | null {
    return this.props.macroSector
  }
}
```

- [ ] **Step 3**: Test → PASS

- [ ] **Step 4**: Commit

```bash
git commit -m "feat(ciiu-taxonomy): add CiiuActivity entity with DIAN structure"
```

---

## Task 2.2 — `CiiuTaxonomyRepository` port + Supabase adapter

**Archivos:**

- Crear: `src/brain/src/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository.ts`
- Crear: `src/brain/src/ciiu-taxonomy/infrastructure/repositories/SupabaseCiiuTaxonomyRepository.ts`

- [ ] **Step 1**: Definir port

```typescript
export interface CiiuTaxonomyRepository {
  findByCode(code: string): Promise<CiiuActivity | null>
  findByCodes(codes: string[]): Promise<CiiuActivity[]>
  findBySection(seccion: string): Promise<CiiuActivity[]>
  findByDivision(division: string): Promise<CiiuActivity[]>
  findByGrupo(grupo: string): Promise<CiiuActivity[]> // requerido por HeuristicClusterer pase 2 (Task 4.3)
  saveAll(activities: CiiuActivity[]): Promise<void>
}
```

- [ ] **Step 2**: Implementar adapter

```typescript
import { Inject, Injectable } from '@nestjs/common'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { CiiuTaxonomyRepository } from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import {
  BrainSupabaseClient,
  SUPABASE_CLIENT,
} from '@/shared/infrastructure/supabase/SupabaseClient'

@Injectable()
export class SupabaseCiiuTaxonomyRepository implements CiiuTaxonomyRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async findByCode(code: string): Promise<CiiuActivity | null> {
    const { data, error } = await this.db
      .from('ciiu_taxonomy')
      .select('*')
      .eq('code', code)
      .maybeSingle()
    if (error) throw error
    return data ? this.toEntity(data) : null
  }

  async findByCodes(codes: string[]): Promise<CiiuActivity[]> {
    if (codes.length === 0) return []
    const { data, error } = await this.db
      .from('ciiu_taxonomy')
      .select('*')
      .in('code', codes)
    if (error) throw error
    return (data ?? []).map((r) => this.toEntity(r))
  }

  async findBySection(seccion: string): Promise<CiiuActivity[]> {
    const { data, error } = await this.db
      .from('ciiu_taxonomy')
      .select('*')
      .eq('seccion', seccion)
    if (error) throw error
    return (data ?? []).map((r) => this.toEntity(r))
  }

  async findByDivision(division: string): Promise<CiiuActivity[]> {
    const { data, error } = await this.db
      .from('ciiu_taxonomy')
      .select('*')
      .eq('division', division)
    if (error) throw error
    return (data ?? []).map((r) => this.toEntity(r))
  }

  async findByGrupo(grupo: string): Promise<CiiuActivity[]> {
    const { data, error } = await this.db
      .from('ciiu_taxonomy')
      .select('*')
      .eq('grupo', grupo)
    if (error) throw error
    return (data ?? []).map((r) => this.toEntity(r))
  }

  async saveAll(activities: CiiuActivity[]): Promise<void> {
    const rows = activities.map((a) => ({
      code: a.code,
      titulo_actividad: a.titulo,
      seccion: a.seccion,
      division: a.division,
      grupo: a.grupo,
      titulo_seccion: a.tituloSeccion,
      titulo_division: a.tituloDivision,
      titulo_grupo: a.tituloGrupo,
      macro_sector: a.macroSector,
    }))
    // Upsert por chunks de 1000 para evitar timeout en 700+ filas
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { error } = await this.db
        .from('ciiu_taxonomy')
        .upsert(chunk, { onConflict: 'code' })
      if (error) throw error
    }
  }

  private toEntity(row: any): CiiuActivity {
    return CiiuActivity.create({
      code: row.code,
      titulo: row.titulo_actividad,
      seccion: row.seccion,
      division: row.division,
      grupo: row.grupo,
      tituloSeccion: row.titulo_seccion,
      tituloDivision: row.titulo_division,
      tituloGrupo: row.titulo_grupo,
      macroSector: row.macro_sector,
    })
  }
}
```

- [ ] **Step 3**: Test integración mínimo (mockear Supabase client con `vi.fn()`):

```typescript
// __tests__/ciiu-taxonomy/SupabaseCiiuTaxonomyRepository.test.ts
import { vi } from 'vitest'

const fakeDb = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi
    .fn()
    .mockResolvedValue({ data: { code: '4711' /* ... */ }, error: null }),
}
// Test instancia el repo con `fakeDb as any` y verifica que toEntity funciona
```

- [ ] **Step 4**: Commit

```bash
git commit -m "feat(ciiu-taxonomy): add repository port and Supabase adapter"
```

---

## Task 2.3 — `FindCiiuByCode` use case + Module

**Archivos:**

- Crear: `src/brain/src/ciiu-taxonomy/application/use-cases/FindCiiuByCode.ts`
- Crear: `src/brain/src/ciiu-taxonomy/ciiu-taxonomy.module.ts`

- [ ] **Step 1**: Use case (trivial)

```typescript
@Injectable()
export class FindCiiuByCode implements UseCase<
  { code: string },
  { activity: CiiuActivity | null }
> {
  constructor(
    @Inject(CIIU_TAXONOMY_REPOSITORY)
    private readonly repo: CiiuTaxonomyRepository,
  ) {}
  async execute(input: { code: string }) {
    return { activity: await this.repo.findByCode(input.code) }
  }
}
```

- [ ] **Step 2**: Module

```typescript
export const CIIU_TAXONOMY_REPOSITORY = Symbol('CIIU_TAXONOMY_REPOSITORY')

@Module({
  providers: [
    {
      provide: CIIU_TAXONOMY_REPOSITORY,
      useClass: SupabaseCiiuTaxonomyRepository,
    },
    FindCiiuByCode,
  ],
  exports: [CIIU_TAXONOMY_REPOSITORY, FindCiiuByCode],
})
export class CiiuTaxonomyModule {}
```

- [ ] **Step 3**: Importar en `AppModule`

- [ ] **Step 4**: Commit

```bash
git commit -m "feat(ciiu-taxonomy): add use case and module wiring"
```

---

# Phase 3 — Companies Context

## Task 3.1 — `Etapa` value object + `EtapaCalculator`

**Archivos:**

- Crear: `src/brain/src/companies/domain/value-objects/Etapa.ts`
- Crear: `src/brain/src/companies/domain/services/EtapaCalculator.ts`
- Crear: `__tests__/companies/EtapaCalculator.test.ts`

- [ ] **Step 1 (RED)**: Test de la heurística

```typescript
import { EtapaCalculator } from '@/companies/domain/services/EtapaCalculator'

describe('EtapaCalculator', () => {
  const baseDate = new Date('2026-04-25')

  it('classifies as nacimiento when < 2 years and personal <= 2', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2024-06-01'),
          personal: 1,
          ingreso: 0,
        },
        baseDate,
      ),
    ).toBe('nacimiento')
  })

  it('classifies as crecimiento when 2-7 years and personal 3-50', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2022-01-01'),
          personal: 10,
          ingreso: 100_000_000,
        },
        baseDate,
      ),
    ).toBe('crecimiento')
  })

  it('classifies as consolidacion when > 7 years', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2015-01-01'),
          personal: 30,
          ingreso: 500_000_000,
        },
        baseDate,
      ),
    ).toBe('consolidacion')
  })

  it('classifies as madurez when personal > 200 OR ingreso > 5000M', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2010-01-01'),
          personal: 250,
          ingreso: 100_000_000,
        },
        baseDate,
      ),
    ).toBe('madurez')

    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2020-01-01'),
          personal: 50,
          ingreso: 6_000_000_000,
        },
        baseDate,
      ),
    ).toBe('madurez')
  })

  it('handles missing fechaMatricula by falling back to personal/ingreso signals', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: null,
          personal: 1,
          ingreso: 0,
        },
        baseDate,
      ),
    ).toBe('nacimiento')
  })
})
```

- [ ] **Step 2 (GREEN)**: Implementar

```typescript
// Etapa.ts
export const ETAPAS = [
  'nacimiento',
  'crecimiento',
  'consolidacion',
  'madurez',
] as const
export type Etapa = (typeof ETAPAS)[number]

export function isEtapa(s: string): s is Etapa {
  return (ETAPAS as readonly string[]).includes(s)
}
```

```typescript
// EtapaCalculator.ts
import { Etapa } from '../value-objects/Etapa'

interface EtapaInput {
  fechaMatricula: Date | null
  personal: number
  ingreso: number
}

const MILLIS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

export class EtapaCalculator {
  static calculate(input: EtapaInput, now: Date = new Date()): Etapa {
    const { fechaMatricula, personal, ingreso } = input

    // Madurez tiene prioridad por señales fuertes
    if (personal > 200 || ingreso > 5_000_000_000) return 'madurez'

    const years = fechaMatricula
      ? (now.getTime() - fechaMatricula.getTime()) / MILLIS_PER_YEAR
      : null

    if (years === null) {
      // Fallback: solo personal/ingreso
      if (personal <= 2 && ingreso < 100_000_000) return 'nacimiento'
      if (personal <= 50) return 'crecimiento'
      return 'consolidacion'
    }

    if (years < 2 && personal <= 2) return 'nacimiento'
    if (years < 7 && personal <= 50) return 'crecimiento'
    return 'consolidacion'
  }
}
```

- [ ] **Step 3**: Test → PASS

- [ ] **Step 4**: Commit

```bash
git commit -m "feat(companies): add Etapa value object and calculator with derivation rules"
```

---

## Task 3.2 — `Company` entity

**Archivos:**

- Crear: `src/brain/src/companies/domain/entities/Company.ts`
- Crear: `__tests__/companies/Company.test.ts`

- [ ] **Step 1 (RED)**: Test factory + invariantes

```typescript
import { Company } from '@/companies/domain/entities/Company'

describe('Company', () => {
  const validInput = {
    id: '0123456-7',
    razonSocial: 'EMPRESA TEST S.A.S',
    ciiu: '4711',
    municipio: 'SANTA MARTA',
    tipoOrganizacion: 'SOCIEDAD',
    personal: 5,
    ingresoOperacion: 100_000_000,
    activosTotales: 200_000_000,
    email: 'test@example.com',
    telefono: '3001234567',
    direccion: 'Calle 1',
    fechaMatricula: new Date('2022-01-01'),
    fechaRenovacion: new Date('2026-01-01'),
    estado: 'ACTIVO',
  }

  it('creates with valid data and derives ciiu_seccion + ciiu_division + ciiu_grupo', () => {
    const c = Company.create(validInput)
    expect(c.id).toBe('0123456-7')
    expect(c.ciiu).toBe('4711')
    expect(c.ciiuSeccion).toBe('G')
    expect(c.ciiuDivision).toBe('47') // primeros 2 dígitos
    expect(c.ciiuGrupo).toBe('471') // primeros 3 dígitos — usado por HeuristicClusterer pase 2
  })

  it('accepts ciiu with section prefix and strips it', () => {
    const c = Company.create({ ...validInput, ciiu: 'G4711' })
    expect(c.ciiu).toBe('4711')
    expect(c.ciiuSeccion).toBe('G')
  })

  it('throws when razon_social is empty', () => {
    expect(() => Company.create({ ...validInput, razonSocial: '' })).toThrow()
  })

  it('throws when id is empty', () => {
    expect(() => Company.create({ ...validInput, id: '' })).toThrow()
  })

  it('throws when ciiu is not 4 digits (after stripping section)', () => {
    expect(() => Company.create({ ...validInput, ciiu: '47' })).toThrow()
  })

  it('derives etapa via EtapaCalculator', () => {
    const c = Company.create({
      ...validInput,
      fechaMatricula: new Date('2025-01-01'),
      personal: 1,
    })
    expect(c.etapa).toBe('nacimiento')
  })
})
```

- [ ] **Step 2 (GREEN)**: Implementar

```typescript
import { Entity } from '@/shared/domain/Entity'
import { Etapa } from '../value-objects/Etapa'
import { EtapaCalculator } from '../services/EtapaCalculator'

interface CompanyProps {
  razonSocial: string
  ciiu: string // 4 dígitos sin sección
  ciiuSeccion: string // 'G'
  ciiuDivision: string // '47' (primeros 2 dígitos)
  ciiuGrupo: string // '471' (primeros 3 dígitos) — usado por HeuristicClusterer pase 2
  municipio: string
  tipoOrganizacion: string | null
  personal: number
  ingresoOperacion: number
  activosTotales: number
  email: string | null
  telefono: string | null
  direccion: string | null
  fechaMatricula: Date | null
  fechaRenovacion: Date | null
  estado: string
  etapa: Etapa
}

export class Company extends Entity<string> {
  private readonly props: CompanyProps
  private constructor(id: string, props: CompanyProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static create(data: {
    id: string
    razonSocial: string
    ciiu: string // puede venir como '4711' o 'G4711'
    municipio: string
    tipoOrganizacion?: string | null
    personal?: number | null
    ingresoOperacion?: number | null
    activosTotales?: number | null
    email?: string | null
    telefono?: string | null
    direccion?: string | null
    fechaMatricula?: Date | null
    fechaRenovacion?: Date | null
    estado?: string
  }): Company {
    if (!data.id || data.id.trim().length === 0)
      throw new Error('Company.id cannot be empty')
    if (!data.razonSocial || data.razonSocial.trim().length === 0) {
      throw new Error('Company.razonSocial cannot be empty')
    }

    const { code, seccion } = parseCiiu(data.ciiu)
    const division = code.slice(0, 2)
    const grupo = code.slice(0, 3)

    const personal = data.personal ?? 0
    const ingreso = data.ingresoOperacion ?? 0
    const fechaMatricula = data.fechaMatricula ?? null

    const etapa = EtapaCalculator.calculate({
      fechaMatricula,
      personal,
      ingreso: ingreso,
    })

    return new Company(data.id.trim(), {
      razonSocial: data.razonSocial.trim(),
      ciiu: code,
      ciiuSeccion: seccion,
      ciiuDivision: division,
      ciiuGrupo: grupo,
      municipio: data.municipio,
      tipoOrganizacion: data.tipoOrganizacion ?? null,
      personal,
      ingresoOperacion: ingreso,
      activosTotales: data.activosTotales ?? 0,
      email: data.email ?? null,
      telefono: data.telefono ?? null,
      direccion: data.direccion ?? null,
      fechaMatricula,
      fechaRenovacion: data.fechaRenovacion ?? null,
      estado: data.estado ?? 'ACTIVO',
      etapa,
    })
  }

  // getters omitidos: razonSocial, ciiu, ciiuSeccion, ciiuDivision, ciiuGrupo,
  // municipio, tipoOrganizacion, personal, ingresoOperacion, activosTotales,
  // email, telefono, direccion, fechaMatricula, fechaRenovacion, estado, etapa
}

/**
 * Parsea CIIU 'G4711' o '4711' devolviendo { code: '4711', seccion: 'G' }.
 * Si viene sin sección, requiere lookup externo — pero para REGISTRADOS_SII.csv
 * el formato es siempre 'X1234' (letra + 4 dígitos).
 */
function parseCiiu(raw: string): { code: string; seccion: string } {
  const trimmed = raw.trim().toUpperCase()
  const withSeccion = /^([A-Z])(\d{4})$/.exec(trimmed)
  if (withSeccion) return { code: withSeccion[2], seccion: withSeccion[1] }
  if (/^\d{4}$/.test(trimmed)) {
    throw new Error(
      `CIIU '${trimmed}' missing section letter. Use the seed/loader to enrich from ciiu_taxonomy first.`,
    )
  }
  throw new Error(`Invalid CIIU format: ${trimmed}`)
}
```

- [ ] **Step 3**: Tests → PASS

- [ ] **Step 4**: Commit

```bash
git commit -m "feat(companies): add Company entity with derived etapa and CIIU parsing"
```

---

## Task 3.3 — `CompanyRepository` port + `SupabaseCompanyRepository`

**Archivos:**

- Crear: `src/brain/src/companies/domain/repositories/CompanyRepository.ts`
- Crear: `src/brain/src/companies/infrastructure/repositories/SupabaseCompanyRepository.ts`
- Crear: `src/brain/src/companies/infrastructure/repositories/InMemoryCompanyRepository.ts`

- [ ] **Step 1**: Port

```typescript
export interface CompanyRepository {
  findAll(): Promise<Company[]>
  findById(id: string): Promise<Company | null>
  findByCiiuDivision(division: string): Promise<Company[]>
  findByMunicipio(municipio: string): Promise<Company[]>
  findUpdatedSince(timestamp: Date): Promise<Company[]>
  saveAll(companies: Company[]): Promise<void>
  count(): Promise<number>
}
```

- [ ] **Step 2**: `SupabaseCompanyRepository` — mismo patrón que CIIU. Mapear row → Company via factory. Importante: `saveAll` con upsert chunked por 500 (10k filas).

- [ ] **Step 3**: `InMemoryCompanyRepository` — `Map<string, Company>` con todos los métodos.

- [ ] **Step 4**: Commit

```bash
git commit -m "feat(companies): add repository port with Supabase + InMemory adapters"
```

---

## Task 3.4 — Use cases: `GetCompanies`, `FindCompanyById`, `GetCompaniesUpdatedSince`

**Archivos:** `src/brain/src/companies/application/use-cases/*.ts` + tests con `InMemoryCompanyRepository`.

- [ ] **Step 1**: TDD para los 3 use cases. El que importa más:

```typescript
// GetCompaniesUpdatedSince.test.ts
it('returns companies updated after the given timestamp', async () => {
  // ... setup InMemory con 3 empresas, 2 con updatedAt > cutoff
  const result = await useCase.execute({ since: cutoff })
  expect(result.companies).toHaveLength(2)
})
```

- [ ] **Step 2**: Implementar (lookup directo al repo, sin lógica adicional).

- [ ] **Step 3**: Commit por use case

```bash
git commit -m "feat(companies): add GetCompanies use case"
git commit -m "feat(companies): add FindCompanyById use case"
git commit -m "feat(companies): add GetCompaniesUpdatedSince use case for agent polling"
```

---

## Task 3.5 — `CompaniesController` + `CompaniesModule`

**Archivos:**

- Crear: `src/brain/src/companies/infrastructure/http/companies.controller.ts`
- Crear: `src/brain/src/companies/companies.module.ts`

- [ ] **Step 1**: Controller con 2 endpoints

```typescript
@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly getCompanies: GetCompanies,
    private readonly findCompanyById: FindCompanyById,
  ) {}

  @Get()
  async list(@Query('limit') limit?: string) {
    const result = await this.getCompanies.execute()
    return result.companies.slice(0, limit ? parseInt(limit) : 50).map(toDto)
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const { company } = await this.findCompanyById.execute({ id })
    if (!company) throw new NotFoundException()
    return toDto(company)
  }
}

function toDto(c: Company) {
  return {
    id: c.id,
    razonSocial: c.razonSocial,
    ciiu: c.ciiu,
    ciiuSeccion: c.ciiuSeccion,
    ciiuDivision: c.ciiuDivision,
    municipio: c.municipio,
    etapa: c.etapa,
    personal: c.personal,
    ingreso: c.ingresoOperacion,
  }
}
```

- [ ] **Step 2**: Module + importar en `AppModule`

- [ ] **Step 3**: Commit

```bash
git commit -m "feat(companies): add HTTP controller and module"
```

---

## Task 3.6 — `CompanySource` port + `SyncCompaniesFromSource` use case

> **Por qué este task existe:** El reto provee acceso a BigQuery "en sobre cerrado al inicio del hackathon", pero hoy NO tenemos las credenciales. Trabajamos con CSVs como mock del dataset real. Para que el switch a BigQuery sea **una sola línea de código** (sin tocar domain ni use cases), introducimos un port `CompanySource` y un use case que lo orquesta. Esta es la inversión de dependencia que permite que el motor inteligente sea agnóstico de la fuente.

**Archivos:**

- Crear: `src/brain/src/companies/domain/sources/CompanySource.ts`
- Crear: `src/brain/src/companies/application/use-cases/SyncCompaniesFromSource.ts`
- Crear: `__tests__/companies/SyncCompaniesFromSource.test.ts`

- [ ] **Step 1 (RED)**: Test del use case con `InMemoryCompanySource` (stub) e `InMemoryCompanyRepository`. Validar que `execute()` lee de la source y persiste vía repo. Validar `execute({ since: Date })` filtra correctamente.

```typescript
// __tests__/companies/SyncCompaniesFromSource.test.ts
describe('SyncCompaniesFromSource', () => {
  it('fetches all companies from source and persists them via repository', async () => {
    const fixtures = [companyFixture('1'), companyFixture('2')]
    const source = new InMemoryCompanySource(fixtures)
    const repo = new InMemoryCompanyRepository()
    const useCase = new SyncCompaniesFromSource(source, repo)

    const result = await useCase.execute()

    expect(result.synced).toBe(2)
    expect(await repo.findAll()).toHaveLength(2)
  })

  it('with `since` arg, only syncs companies updated after that date', async () => {
    const old = companyFixture('1', { updatedAt: new Date('2025-01-01') })
    const recent = companyFixture('2', { updatedAt: new Date('2026-04-25') })
    const source = new InMemoryCompanySource([old, recent])
    const repo = new InMemoryCompanyRepository()
    const useCase = new SyncCompaniesFromSource(source, repo)

    const result = await useCase.execute({ since: new Date('2026-01-01') })

    expect(result.synced).toBe(1)
  })
})
```

- [ ] **Step 2 (GREEN)**: Crear el port.

```typescript
// src/brain/src/companies/domain/sources/CompanySource.ts
import { Company } from '../entities/Company'

/**
 * PORT — fuente externa de empresas (read-only).
 *
 * Hoy implementado por `CsvCompanySource` (mock de los datos del reto).
 * Mañana, cuando lleguen las credenciales de BigQuery del reto, se agrega
 * `BigQueryCompanySource` implementando esta misma interface y se cambia UNA
 * línea en `companies.module.ts`. Domain y use cases NO se enteran.
 */
export interface CompanySource {
  fetchAll(): Promise<Company[]>
  fetchUpdatedSince(since: Date): Promise<Company[]>
}
```

- [ ] **Step 3 (GREEN)**: Crear el use case.

```typescript
// src/brain/src/companies/application/use-cases/SyncCompaniesFromSource.ts
import { Inject, Injectable } from '@nestjs/common'
import { COMPANY_SOURCE } from '../../domain/sources/CompanySource.token'
import { CompanyRepository } from '../../domain/repositories/CompanyRepository'
import { COMPANY_REPOSITORY } from '../../domain/repositories/CompanyRepository.token'
import type { CompanySource } from '../../domain/sources/CompanySource'

interface SyncInput {
  since?: Date
}

@Injectable()
export class SyncCompaniesFromSource {
  constructor(
    @Inject(COMPANY_SOURCE) private readonly source: CompanySource,
    @Inject(COMPANY_REPOSITORY) private readonly repo: CompanyRepository,
  ) {}

  async execute(input: SyncInput = {}): Promise<{ synced: number }> {
    const companies = input.since
      ? await this.source.fetchUpdatedSince(input.since)
      : await this.source.fetchAll()

    await this.repo.saveMany(companies)
    return { synced: companies.length }
  }
}
```

- [ ] **Step 4 (GREEN)**: Asegurar que `InMemoryCompanyRepository` tiene `saveMany()` (si no, agregarlo). Crear `InMemoryCompanySource` en `__tests__/fixtures/`.

- [ ] **Step 5**: Tests verdes (`bun --filter brain test:run`).

- [ ] **Step 6**: Commit.

```bash
git commit -m "feat(companies): add CompanySource port and SyncCompaniesFromSource use case"
```

---

## Task 3.7 — `CsvCompanySource` adapter (mock del dataset BQ del reto)

**Archivos:**

- Crear: `src/brain/src/companies/infrastructure/sources/CsvCompanySource.ts`
- Crear: `__tests__/companies/CsvCompanySource.test.ts`
- Modificar: `src/brain/src/companies/companies.module.ts` (registrar el provider)

- [ ] **Step 1 (RED)**: Test del adapter — debe leer el CSV real y mapear a `Company` entities. Validar que `fetchAll()` retorna ~10k empresas y que `fetchUpdatedSince()` filtra por `fechaRenovacion`.

```typescript
// __tests__/companies/CsvCompanySource.test.ts
describe('CsvCompanySource', () => {
  it('reads REGISTRADOS_SII.csv and returns Company entities', async () => {
    const source = new CsvCompanySource(new CsvLoader(), new EtapaCalculator())

    const companies = await source.fetchAll()

    expect(companies.length).toBeGreaterThan(9000)
    expect(companies[0]).toBeInstanceOf(Company)
    expect(companies[0].ciiuDivision).toMatch(/^\d{2}$/)
  })

  it('fetchUpdatedSince filters by fechaRenovacion', async () => {
    const source = new CsvCompanySource(new CsvLoader(), new EtapaCalculator())

    const recent = await source.fetchUpdatedSince(new Date('2024-01-01'))
    const all = await source.fetchAll()

    expect(recent.length).toBeLessThanOrEqual(all.length)
  })
})
```

- [ ] **Step 2 (GREEN)**: Implementar el adapter delegando parsing al `CsvLoader` ya existente. La lógica de mapeo CSV → `Company.create()` se mueve acá desde el seed (ver Task 7.2).

```typescript
// src/brain/src/companies/infrastructure/sources/CsvCompanySource.ts
import { Injectable } from '@nestjs/common'
import { CompanySource } from '../../domain/sources/CompanySource'
import { Company } from '../../domain/entities/Company'
import { CsvLoader } from '../../../shared/infrastructure/csv/CsvLoader'
import { DataPaths } from '../../../shared/infrastructure/path/DataPaths'
import { EtapaCalculator } from '../../domain/services/EtapaCalculator'

@Injectable()
export class CsvCompanySource implements CompanySource {
  constructor(
    private readonly csvLoader: CsvLoader,
    private readonly etapaCalculator: EtapaCalculator,
  ) {}

  async fetchAll(): Promise<Company[]> {
    const rows = await this.csvLoader.load(DataPaths.companiesCsv)
    return rows.map((row) => this.toCompany(row))
  }

  async fetchUpdatedSince(since: Date): Promise<Company[]> {
    const all = await this.fetchAll()
    return all.filter((c) => c.fechaRenovacion && c.fechaRenovacion > since)
  }

  private toCompany(row: Record<string, string>): Company {
    // Lógica de mapeo CSV → Company (idéntica a la del seed actual de Task 7.2,
    // que ahora delega acá).
    return Company.create({
      /* ... */
    })
  }
}
```

- [ ] **Step 3 (GREEN)**: Wirear en el module.

```typescript
// src/brain/src/companies/companies.module.ts
@Module({
  imports: [SharedModule],
  controllers: [CompaniesController],
  providers: [
    EtapaCalculator,
    GetCompanies,
    FindCompanyById,
    GetCompaniesUpdatedSince,
    SyncCompaniesFromSource,
    {
      provide: COMPANY_REPOSITORY,
      useClass: SupabaseCompanyRepository,
    },
    {
      provide: COMPANY_SOURCE,
      useClass: CsvCompanySource, // ← cambiar a BigQueryCompanySource cuando lleguen las creds del reto
    },
  ],
  exports: [
    GetCompanies,
    FindCompanyById,
    GetCompaniesUpdatedSince,
    SyncCompaniesFromSource,
    COMPANY_REPOSITORY,
    COMPANY_SOURCE,
  ],
})
export class CompaniesModule {}
```

- [ ] **Step 4**: Tests verdes (`bun --filter brain test:run`).

- [ ] **Step 5**: Commit.

```bash
git commit -m "feat(companies): add CsvCompanySource adapter (BQ dataset mock)"
```

---

# Phase 4 — Clusters Context

## Task 4.1 — `ClusterType` value object + `Cluster` entity

**Archivos:**

- Crear: `src/brain/src/clusters/domain/value-objects/ClusterType.ts`
- Crear: `src/brain/src/clusters/domain/entities/Cluster.ts`
- Crear: `__tests__/clusters/Cluster.test.ts`

- [ ] **Step 1**: Value object

```typescript
export const CLUSTER_TYPES = [
  'predefined',
  'heuristic-division',
  'heuristic-grupo',
  'heuristic-municipio',
] as const
export type ClusterType = (typeof CLUSTER_TYPES)[number]
```

- [ ] **Step 2**: Entity con factory

```typescript
export class Cluster extends Entity<string> {
  // props: codigo, titulo, descripcion, tipo, ciiuDivision?, ciiuGrupo?, municipio?, macroSector?, memberCount
  // Validaciones del factory:
  //   - titulo no vacío
  //   - tipo='heuristic-division' → ciiuDivision requerido
  //   - tipo='heuristic-grupo'    → ciiuDivision Y ciiuGrupo requeridos (grupo es 3 dígitos, debe empezar por la división)
  //   - tipo='heuristic-municipio' → municipio requerido
  //   - tipo='predefined' → ningún campo geográfico/CIIU obligatorio
}
```

Convención de IDs:

- predefined: `pred-{clusterID}` (ej. `pred-7` para LOGISTICA)
- heuristic-division: `div-{ciiuDivision}-{municipio}` (ej. `div-47-SANTA_MARTA`)
- heuristic-grupo: `grp-{ciiuGrupo}-{municipio}` (ej. `grp-477-SANTA_MARTA`) — más fino que división
- heuristic-municipio: `mun-{municipio}` (no se usa en este plan, reservado para futuro)

Tests obligatorios para la entity:

- Crear cluster `heuristic-grupo` SIN `ciiuGrupo` → debe tirar error
- Crear cluster `heuristic-grupo` con `ciiuGrupo='477'` y `ciiuDivision='48'` (no concuerdan) → debe tirar error (el grupo debe empezar por los dígitos de la división)
- Crear cluster `heuristic-grupo` con `ciiuGrupo='477'` y `ciiuDivision='47'` → ok

- [ ] **Step 3**: Tests + Commit

```bash
git commit -m "feat(clusters): add Cluster entity with type validation"
```

---

## Task 4.2 — Repositorios de clusters (3 ports + adapters)

**Archivos:**

- `ClusterRepository.ts` — CRUD de clusters
- `ClusterMembershipRepository.ts` — vínculo company ↔ cluster
- `ClusterCiiuMappingRepository.ts` — predefined cluster_id → ciiu_code

Implementar Supabase + InMemory para los 3.

- [ ] **Step 1-3**: Implementar los 3 puertos + adapters con tests

- [ ] **Step 4**: Commit por repositorio

```bash
git commit -m "feat(clusters): add cluster repository port and adapters"
git commit -m "feat(clusters): add cluster membership repository"
git commit -m "feat(clusters): add cluster-ciiu mapping repository"
```

---

## Task 4.3 — `HeuristicClusterer` service (cascada de 2 niveles)

**Archivos:**

- Crear: `src/brain/src/clusters/application/services/HeuristicClusterer.ts`
- Crear: `__tests__/clusters/HeuristicClusterer.test.ts`

Estrategia (**cascada**):

**Pase 1 — División (cluster amplio):**

1. Agrupar todas las companies por `(ciiu_division, municipio)`
2. Crear cluster `heuristic-division` solo si el grupo tiene **>= 5 miembros**
3. ID: `div-{ciiuDivision}-{slug(municipio)}`
4. Título: usar `tituloDivision` de CIIU taxonomy + municipio

**Pase 2 — Grupo (cluster de nicho, ADITIVO al de división):**

1. Para cada `(ciiu_grupo, municipio)` (3 dígitos + municipio)
2. Crear cluster `heuristic-grupo` solo si el grupo tiene **>= 10 miembros** (umbral mayor para evitar microclusters)
3. ID: `grp-{ciiuGrupo}-{slug(municipio)}`
4. Título: usar `tituloGrupo` de CIIU taxonomy + municipio
5. Una empresa puede pertenecer a su `div-X-Y` Y a su `grp-XYZ-Y` simultáneamente (N:M en `cluster_members`)

> **Nota de diseño:** El pase de grupo NO depende del pase de división — corren independientemente sobre el mismo dataset. Esto permite que existan clusters de grupo aunque la división no llegue al umbral (caso raro pero posible: 3 empresas grupo 477 + 7 empresas grupo 472 en el mismo municipio = división 47 NO califica con 10 < 5+5, esperá... — sí califica división, son 10 totales. Pero ningún grupo individual llega a 10 → solo cluster de división. Este caso muestra que los pases son ortogonales).

- [ ] **Step 1 (RED)**: Tests con fixtures que cubran AMBOS niveles + caso ortogonal

```typescript
describe('HeuristicClusterer', () => {
  it('PASE 1: groups by (ciiu_division, municipio) when group >= 5', async () => {
    const companies = [
      /* 6 empresas con ciiu='4711', municipio='SANTA MARTA' (división 47, grupo 471) */
      /* 3 empresas con ciiu='4921', municipio='SANTA MARTA' (descartadas — división 49 < 5) */
      /* 5 empresas con ciiu='5611', municipio='CIENAGA' (división 56, grupo 561) */
    ]
    const ciiuRepo = new StubCiiuTaxonomyRepository(/* mocks */)
    const clusterer = new HeuristicClusterer(ciiuRepo)

    const result = await clusterer.cluster(companies)

    const divClusters = result.filter(
      (r) => r.cluster.tipo === 'heuristic-division',
    )
    expect(divClusters).toHaveLength(2) // 47-SANTA_MARTA y 56-CIENAGA
    expect(divClusters[0].cluster.titulo).toContain('Comercio al por menor')
  })

  it('PASE 2: groups by (ciiu_grupo, municipio) when group >= 10', async () => {
    const companies = [
      /* 12 empresas con ciiu='4771', municipio='SANTA MARTA' (grupo 477) */
      /* 8 empresas con ciiu='4761', municipio='SANTA MARTA' (grupo 476, descartadas < 10) */
    ]
    const ciiuRepo = new StubCiiuTaxonomyRepository(/* ... */)
    const clusterer = new HeuristicClusterer(ciiuRepo)

    const result = await clusterer.cluster(companies)

    const grupoClusters = result.filter(
      (r) => r.cluster.tipo === 'heuristic-grupo',
    )
    expect(grupoClusters).toHaveLength(1) // solo grupo 477
    expect(grupoClusters[0].cluster.id).toBe('grp-477-SANTA_MARTA')
  })

  it('CASCADA: empresa pertenece a cluster división Y a cluster grupo cuando ambos califican', async () => {
    const companies = [
      /* 12 empresas con ciiu='4771', municipio='SANTA MARTA'
         → división 47 califica (12 >= 5)
         → grupo 477 califica (12 >= 10)
         Ambos clusters deben crearse, las 12 empresas son miembros de los DOS */
    ]
    const ciiuRepo = new StubCiiuTaxonomyRepository(/* ... */)
    const clusterer = new HeuristicClusterer(ciiuRepo)

    const result = await clusterer.cluster(companies)

    expect(result).toHaveLength(2)
    const divCluster = result.find(
      (r) => r.cluster.tipo === 'heuristic-division',
    )!
    const grpCluster = result.find((r) => r.cluster.tipo === 'heuristic-grupo')!
    expect(divCluster.members).toHaveLength(12)
    expect(grpCluster.members).toHaveLength(12)
    // Cada miembro del cluster grupo TAMBIÉN está en el cluster división
    expect(
      grpCluster.members.every((m) => divCluster.members.includes(m)),
    ).toBe(true)
  })

  it('ORTOGONAL: división califica pero ningún grupo individual llega a 10 → solo cluster división', async () => {
    const companies = [
      /* 6 empresas con ciiu='4711' (grupo 471), municipio='SANTA MARTA' */
      /* 4 empresas con ciiu='4721' (grupo 472), municipio='SANTA MARTA' */
      // Total división 47 = 10 (>= 5), pero ni 471 ni 472 llegan a 10 individualmente
    ]
    const ciiuRepo = new StubCiiuTaxonomyRepository(/* ... */)
    const clusterer = new HeuristicClusterer(ciiuRepo)

    const result = await clusterer.cluster(companies)

    expect(
      result.filter((r) => r.cluster.tipo === 'heuristic-division'),
    ).toHaveLength(1)
    expect(
      result.filter((r) => r.cluster.tipo === 'heuristic-grupo'),
    ).toHaveLength(0)
  })
})
```

- [ ] **Step 2 (GREEN)**: Implementar con dos pases

```typescript
@Injectable()
export class HeuristicClusterer {
  constructor(
    @Inject(CIIU_TAXONOMY_REPOSITORY)
    private readonly ciiuRepo: CiiuTaxonomyRepository,
  ) {}

  private static readonly MIN_DIVISION_SIZE = 5
  private static readonly MIN_GRUPO_SIZE = 10

  async cluster(
    companies: Company[],
  ): Promise<{ cluster: Cluster; members: Company[] }[]> {
    const out: { cluster: Cluster; members: Company[] }[] = []

    // ===== PASE 1: División =====
    const divGroups = this.groupBy(
      companies,
      (c) => `${c.ciiuDivision}|${c.municipio}`,
    )
    const eligibleDivisions = new Set<string>()
    for (const [key, members] of divGroups) {
      if (members.length >= HeuristicClusterer.MIN_DIVISION_SIZE) {
        eligibleDivisions.add(key.split('|')[0])
      }
    }
    const divisionTitles = await this.fetchDivisionTitles(eligibleDivisions)

    for (const [key, members] of divGroups) {
      if (members.length < HeuristicClusterer.MIN_DIVISION_SIZE) continue
      const [div, mun] = key.split('|')
      const titulo = divisionTitles.get(div) ?? `División ${div}`
      out.push({
        cluster: Cluster.create({
          id: `div-${div}-${slug(mun)}`,
          codigo: `${div}-${slug(mun)}`,
          titulo: `${titulo} en ${mun}`,
          descripcion: `Empresas con CIIU división ${div} ubicadas en ${mun}`,
          tipo: 'heuristic-division',
          ciiuDivision: div,
          municipio: mun,
          memberCount: members.length,
        }),
        members,
      })
    }

    // ===== PASE 2: Grupo (3 dígitos) — independiente del pase 1 =====
    const grpGroups = this.groupBy(
      companies,
      (c) => `${c.ciiuGrupo}|${c.ciiuDivision}|${c.municipio}`,
    )
    const eligibleGrupos = new Set<string>()
    for (const [key, members] of grpGroups) {
      if (members.length >= HeuristicClusterer.MIN_GRUPO_SIZE) {
        eligibleGrupos.add(key.split('|')[0])
      }
    }
    const grupoTitles = await this.fetchGrupoTitles(eligibleGrupos)

    for (const [key, members] of grpGroups) {
      if (members.length < HeuristicClusterer.MIN_GRUPO_SIZE) continue
      const [grp, div, mun] = key.split('|')
      const titulo = grupoTitles.get(grp) ?? `Grupo ${grp}`
      out.push({
        cluster: Cluster.create({
          id: `grp-${grp}-${slug(mun)}`,
          codigo: `${grp}-${slug(mun)}`,
          titulo: `${titulo} en ${mun}`,
          descripcion: `Empresas con CIIU grupo ${grp} ubicadas en ${mun}`,
          tipo: 'heuristic-grupo',
          ciiuDivision: div,
          ciiuGrupo: grp,
          municipio: mun,
          memberCount: members.length,
        }),
        members,
      })
    }

    return out
  }

  private groupBy<T>(items: T[], keyFn: (t: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>()
    for (const item of items) {
      const key = keyFn(item)
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return map
  }

  private async fetchDivisionTitles(
    divisions: Set<string>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    const batches = await Promise.all(
      Array.from(divisions).map((d) => this.ciiuRepo.findByDivision(d)),
    )
    for (const acts of batches) {
      if (acts.length > 0) result.set(acts[0].division, acts[0].tituloDivision)
    }
    return result
  }

  private async fetchGrupoTitles(
    grupos: Set<string>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    const batches = await Promise.all(
      Array.from(grupos).map((g) => this.ciiuRepo.findByGrupo(g)),
    )
    for (const acts of batches) {
      if (acts.length > 0) result.set(acts[0].grupo, acts[0].tituloGrupo)
    }
    return result
  }
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase()
}
```

> **Dependencia:** Este servicio asume que `CiiuTaxonomyRepository` (Task 2.2) expone `findByGrupo(grupo: string): Promise<CiiuActivity[]>`. **Acción requerida en Task 2.2:** agregar ese método al port y al adapter Supabase. La query es: `SELECT * FROM ciiu_taxonomy WHERE grupo = $1`.

- [ ] **Step 3-4**: Test + Commit

```bash
git commit -m "feat(clusters): add HeuristicClusterer with 2-level cascading (division + grupo)"
```

---

## Task 4.4 — `PredefinedClusterMatcher` service

Usa `cluster_ciiu_mapping` (cargado desde `CLUSTERS_ACTIVIDADESECONOMICAS.csv`) para asignar empresas a los 8 clusters predefinidos.

```typescript
@Injectable()
export class PredefinedClusterMatcher {
  constructor(
    @Inject(CLUSTER_REPOSITORY) private readonly clusterRepo: ClusterRepository,
    @Inject(CLUSTER_CIIU_MAPPING_REPOSITORY)
    private readonly mappingRepo: ClusterCiiuMappingRepository,
  ) {}

  async match(companies: Company[]): Promise<Map<string, Company[]>> {
    const ciiuToClusterIds = await this.mappingRepo.getCiiuToClusterMap()
    // companies se distribuyen a los clusters predefinidos cuyo CIIU coincide
    const result = new Map<string, Company[]>()
    for (const c of companies) {
      const clusterIds = ciiuToClusterIds.get(c.ciiu) ?? []
      for (const cid of clusterIds) {
        const arr = result.get(cid) ?? []
        arr.push(c)
        result.set(cid, arr)
      }
    }
    return result
  }
}
```

- [ ] **Step 1-3**: TDD + Commit

```bash
git commit -m "feat(clusters): add PredefinedClusterMatcher using cluster_ciiu_mapping"
```

---

## Task 4.5 — `GenerateClusters` use case

Orquesta:

1. Cargar todas las companies (estado ACTIVO)
2. Correr `PredefinedClusterMatcher` → asignaciones a 8 clusters
3. Correr `HeuristicClusterer` → asignaciones a clusters dinámicos
4. Persistir los Cluster + ClusterMembers
5. Retornar `{ predefinedClusters: number, heuristicClusters: number, totalMemberships: number }`

- [ ] **Step 1-3**: TDD + Commit

```bash
git commit -m "feat(clusters): add GenerateClusters use case orchestrating both matchers"
```

---

## Task 4.6 — `GetCompanyClusters` + `ExplainCluster` use cases

`GetCompanyClusters({ companyId })` → devuelve los clusters a los que pertenece.

`ExplainCluster({ clusterId })` → si el cluster ya tiene `descripcion` no nula, devolverla; si no, llamar Gemini con prompt:

```
Sos un consultor empresarial. Te paso un cluster de empresas y necesito que generes
una descripción de 2-3 frases explicando qué tienen en común y qué oportunidades de
negocio podrían surgir entre ellas.

Cluster: {titulo}
Tipo: {tipo}
División CIIU: {ciiuDivision} ({tituloDivision})
Municipio: {municipio}
Cantidad de empresas: {memberCount}
Ejemplos: {3 razones sociales aleatorias}

Responde en español, tono profesional pero cercano.
```

Cachear la respuesta en `clusters.descripcion` (UPDATE en Supabase).

- [ ] **Step 1-3**: TDD con `StubGeminiAdapter` + Commit

```bash
git commit -m "feat(clusters): add GetCompanyClusters and ExplainCluster use cases"
```

---

## Task 4.7 — `ClustersController` + `ClustersModule`

- `POST /api/clusters/generate` → ejecuta `GenerateClusters`, retorna stats
- `GET /api/clusters/:id/explain` → ejecuta `ExplainCluster`, retorna `{ description }`
- `GET /api/companies/:id/clusters` → ejecuta `GetCompanyClusters`

- [ ] **Step 1**: Controller + Module + importar en AppModule

- [ ] **Step 2**: Commit

```bash
git commit -m "feat(clusters): add HTTP controller and module"
```

---

# Phase 5 — Recommendations Context

Esta es la fase más larga porque es el corazón del motor. **Aprox 18 archivos.**

> **Arquitectura AI-first**: el `AiMatchEngine` evalúa pares CIIU usando las 24 reglas + 6 ecosistemas como CONTEXTO en el prompt (no como filtros). El cache por par CIIU es la base — ~25k pares máximos vs. 100M de pares empresa. Los matchers hardcoded (PeerMatcher, ValueChainMatcher, AllianceMatcher) quedan como FALLBACK cuando AI falla o se desactiva.

**Orden de ejecución del motor:**

```
GenerateRecommendations:
  1. CiiuPairEvaluator → para cada par CIIU único del universo, asegurar que está en cache
                         (si no, llamar AiMatchEngine con rules+ecosystems en el prompt)
  2. CandidateSelector → para cada empresa, listar candidates filtrados por cache hits
  3. Para cada par (source, target) candidate:
        a. Leer cache_entry por (source.ciiu, target.ciiu)
        b. Si has_match → crear Recommendation con score = confidence × proximity_boost
  4. Si AI deshabilitada o cache vacío → fallback a los 3 matchers hardcoded
  5. Dedupe + limit + persist
```

## Task 5.1 — `RelationType` value object

**Archivos:**

- `src/brain/src/recommendations/domain/value-objects/RelationType.ts`

```typescript
export const RELATION_TYPES = [
  'referente',
  'cliente',
  'proveedor',
  'aliado',
] as const
export type RelationType = (typeof RELATION_TYPES)[number]

export function isRelationType(s: string): s is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(s)
}

export function inverseRelation(t: RelationType): RelationType {
  switch (t) {
    case 'cliente':
      return 'proveedor'
    case 'proveedor':
      return 'cliente'
    case 'referente':
      return 'referente' // simétrica
    case 'aliado':
      return 'aliado' // simétrica
  }
}
```

- [ ] Test + commit

```bash
git commit -m "feat(recommendations): add RelationType value object with inverse mapping"
```

---

## Task 5.2 — `Reason` value object (estructurado)

**Archivos:**

- `src/brain/src/recommendations/domain/value-objects/Reason.ts`

```typescript
/**
 * Reason — razón estructurada de una recomendación.
 * Las razones se acumulan como array y se serializan a JSONB.
 */
export type ReasonFeature =
  | 'mismo_ciiu_clase'
  | 'mismo_ciiu_division'
  | 'mismo_ciiu_seccion'
  | 'mismo_municipio'
  | 'misma_etapa'
  | 'misma_macro_sector'
  | 'cadena_valor_directa' // para cliente/proveedor
  | 'cadena_valor_inversa'
  | 'ecosistema_compartido' // para aliado
  | 'ai_inferido' // para AI inferer

export interface Reason {
  feature: ReasonFeature
  weight: number // 0..1
  value?: string | number // valor concreto (ej. '47', 'SANTA MARTA')
  description: string // texto humano corto
}

export class Reasons {
  private constructor(private readonly items: Reason[]) {}

  static empty(): Reasons {
    return new Reasons([])
  }
  static from(items: Reason[]): Reasons {
    return new Reasons([...items])
  }

  add(reason: Reason): Reasons {
    return new Reasons([...this.items, reason])
  }
  totalWeight(): number {
    return this.items.reduce((s, r) => s + r.weight, 0)
  }
  toJson(): Reason[] {
    return [...this.items]
  }
}
```

- [ ] Test + commit

```bash
git commit -m "feat(recommendations): add Reason value object with structured features"
```

---

## Task 5.3 — `Recommendation` entity

**Archivos:**

- `src/brain/src/recommendations/domain/entities/Recommendation.ts`

```typescript
export class Recommendation extends Entity<string> {
  // props: sourceCompanyId, targetCompanyId, relationType, score, reasons (Reasons),
  //        source ('rule' | 'cosine' | 'ecosystem' | 'ai-inferred'),
  //        explanation: string | null, explanationCachedAt: Date | null

  static create(data: { ... }): Recommendation {
    if (data.sourceCompanyId === data.targetCompanyId) {
      throw new Error('Cannot recommend a company to itself')
    }
    if (data.score < 0 || data.score > 1) {
      throw new Error(`Score must be 0..1, got ${data.score}`)
    }
    // ...
  }
}
```

- [ ] Test + commit

```bash
git commit -m "feat(recommendations): add Recommendation entity with invariants"
```

---

## Task 5.4 — `RecommendationRepository` + `AiMatchCacheRepository`

Implementar ports + Supabase adapters + InMemory.

`RecommendationRepository`:

```typescript
interface RecommendationRepository {
  saveAll(recs: Recommendation[]): Promise<void>
  findBySource(sourceId: string, limit?: number): Promise<Recommendation[]>
  findBySourceAndType(
    sourceId: string,
    type: RelationType,
    limit?: number,
  ): Promise<Recommendation[]>
  updateExplanation(id: string, explanation: string): Promise<void>
  countBySource(sourceId: string): Promise<number>
  deleteAll(): Promise<void> // útil para regenerar
}
```

`AiMatchCacheRepository`:

```typescript
interface AiMatchCacheRepository {
  get(
    ciiuOrigen: string,
    ciiuDestino: string,
  ): Promise<AiMatchCacheEntry | null>
  put(entry: AiMatchCacheEntry): Promise<void>
  size(): Promise<number>
}
```

- [ ] Tests + commits

```bash
git commit -m "feat(recommendations): add recommendation repository port and adapters"
git commit -m "feat(recommendations): add AI match cache repository"
```

---

## Task 5.5 — `ValueChainRules` registry (guía para AI + datos para fallback)

**Archivos:**

- `src/brain/src/recommendations/application/services/ValueChainRules.ts`

> **Doble rol**: este registry es (1) CONTEXTO que se inyecta en el prompt del `AiMatchEngine` para guiar a Gemini, y (2) datos hardcoded para los matchers de fallback (`ValueChainMatcher`, `AllianceMatcher`).

```typescript
/**
 * Reglas de cadena de valor — basadas en CIIUs DIAN reales presentes en los datos.
 * Cada regla es UNIDIRECCIONAL: ciiuOrigen produce algo que ciiuDestino consume.
 *
 * Cuando se usan en `AiMatchEngine`: se filtran las reglas que aplican al par CIIU
 * que se está evaluando y se envían en el prompt como guía/contexto.
 *
 * Cuando se usan en `ValueChainMatcher` (fallback): se generan DOS recomendaciones
 * por regla (cliente / proveedor invertidas).
 */
export interface ValueChainRule {
  ciiuOrigen: string // 4 dígitos
  ciiuDestino: string // 4 dígitos | '*' (cualquier sección) | regex de prefijo
  weight: number // 0..1 — confianza de la regla
  description: string // qué se transa
}

export const VALUE_CHAIN_RULES: ValueChainRule[] = [
  // === Agro → Comercio mayorista ===
  {
    ciiuOrigen: '0122',
    ciiuDestino: '4631',
    weight: 0.85,
    description: 'Banano hacia mayoristas de alimentos',
  },
  {
    ciiuOrigen: '0126',
    ciiuDestino: '4631',
    weight: 0.85,
    description: 'Palma de aceite hacia mayoristas',
  },
  {
    ciiuOrigen: '0121',
    ciiuDestino: '4720',
    weight: 0.8,
    description: 'Frutas tropicales hacia minoristas alimentos',
  },
  // === Mayoristas → HORECA ===
  {
    ciiuOrigen: '4631',
    ciiuDestino: '5611',
    weight: 0.85,
    description: 'Mayorista de alimentos abastece restaurantes',
  },
  {
    ciiuOrigen: '4631',
    ciiuDestino: '5630',
    weight: 0.75,
    description: 'Mayorista abastece bares',
  },
  {
    ciiuOrigen: '4719',
    ciiuDestino: '5611',
    weight: 0.7,
    description: 'Mayorista general hacia restaurantes',
  },
  // === Transporte ===
  {
    ciiuOrigen: '4923',
    ciiuDestino: '4290',
    weight: 0.85,
    description: 'Transporte de carga para construcción',
  },
  {
    ciiuOrigen: '4923',
    ciiuDestino: '4631',
    weight: 0.8,
    description: 'Transporte de carga para mayoristas',
  },
  {
    ciiuOrigen: '4923',
    ciiuDestino: '0122',
    weight: 0.75,
    description: 'Transporte de carga para agro',
  },
  {
    ciiuOrigen: '6810',
    ciiuDestino: '4921',
    weight: 0.85,
    description: 'Alquiler de vehículos para flotas de transporte',
  },
  {
    ciiuOrigen: '6810',
    ciiuDestino: '4923',
    weight: 0.85,
    description: 'Alquiler de vehículos para flotas de carga',
  },
  // === Construcción ===
  {
    ciiuOrigen: '4111',
    ciiuDestino: '4290',
    weight: 0.85,
    description: 'Movimiento de tierra para construcción general',
  },
  {
    ciiuOrigen: '4752',
    ciiuDestino: '4290',
    weight: 0.85,
    description: 'Ferretería abastece obras',
  },
  {
    ciiuOrigen: '7112',
    ciiuDestino: '4290',
    weight: 0.85,
    description: 'Ingeniería para construcción',
  },
  {
    ciiuOrigen: '6910',
    ciiuDestino: '4290',
    weight: 0.65,
    description: 'Servicios legales para constructoras',
  },
  // === Servicios → HORECA ===
  {
    ciiuOrigen: '7912',
    ciiuDestino: '5511',
    weight: 0.85,
    description: 'Seguridad para hoteles',
  },
  {
    ciiuOrigen: '7912',
    ciiuDestino: '4290',
    weight: 0.75,
    description: 'Seguridad para obras',
  },
  {
    ciiuOrigen: '7020',
    ciiuDestino: '5511',
    weight: 0.6,
    description: 'Eventos corporativos en hoteles',
  },
  {
    ciiuOrigen: '4921',
    ciiuDestino: '5511',
    weight: 0.85,
    description: 'Transporte turístico hacia hoteles',
  },
  {
    ciiuOrigen: '4921',
    ciiuDestino: '5519',
    weight: 0.85,
    description: 'Transporte turístico hacia hostales',
  },
  {
    ciiuOrigen: '7310',
    ciiuDestino: '5611',
    weight: 0.65,
    description: 'Publicidad para restaurantes',
  },
  {
    ciiuOrigen: '7310',
    ciiuDestino: '5511',
    weight: 0.65,
    description: 'Publicidad para hoteles',
  },
  // === Servicios profesionales universales (target=*) ===
  {
    ciiuOrigen: '6910',
    ciiuDestino: '*',
    weight: 0.4,
    description: 'Servicios legales B2B universal',
  },
  {
    ciiuOrigen: '7020',
    ciiuDestino: '*',
    weight: 0.4,
    description: 'Servicios contables/asesoría B2B universal',
  },
]

/**
 * 6 ECOSISTEMAS — usados como CONTEXTO en el prompt del AiMatchEngine
 * y como datos del AllianceMatcher (fallback).
 * Cada ecosistema agrupa CIIUs que sirven al MISMO cliente final pero NO se compiten directamente.
 */
export interface Ecosystem {
  id: string
  name: string
  ciiuCodes: string[]
  description: string
}

export const ECOSYSTEMS: Ecosystem[] = [
  {
    id: 'turismo',
    name: 'Turismo',
    ciiuCodes: ['5511', '5519', '5611', '5630', '4921', '6810'],
    description: 'Empresas que sirven al turista que visita Santa Marta',
  },
  {
    id: 'construccion',
    name: 'Construcción',
    ciiuCodes: ['4290', '4111', '7112', '4752', '6910', '4923'],
    description: 'Cadena del proyecto inmobiliario y obra civil',
  },
  {
    id: 'servicios-profesionales',
    name: 'Servicios Profesionales B2B',
    ciiuCodes: ['6910', '7020', '7490', '7310'],
    description: 'Servicios complementarios para empresas',
  },
  {
    id: 'agro-exportador',
    name: 'Agro Exportador',
    ciiuCodes: ['0122', '0126', '0121', '4631', '4923'],
    description: 'Cadena agro-exportador del Magdalena',
  },
  {
    id: 'salud',
    name: 'Salud',
    ciiuCodes: ['8610', '8621', '8692', '7912'],
    description: 'Ecosistema de servicios de salud',
  },
  {
    id: 'educacion',
    name: 'Educación',
    ciiuCodes: ['8512', '8551', '8559'],
    description: 'Ecosistema educativo formal y no formal',
  },
]
```

- [ ] **Step 1**: Test mínimo (carga + estructura: 24 rules + 6 ecosystems, todas con CIIUs presentes en los datos)

- [ ] **Step 2**: Commit

```bash
git commit -m "feat(recommendations): add value chain rules registry (24 rules + 6 ecosystems)"
```

---

## Task 5.6 — `AiMatchEngine` service (motor PRINCIPAL)

**Archivos:**

- Crear: `src/brain/src/recommendations/application/services/AiMatchEngine.ts`
- Crear: `__tests__/recommendations/AiMatchEngine.test.ts`

> **Este es el matcher principal del sistema.** Recibe un par CIIU (origen, destino) y devuelve si hay match + tipo + confianza + razón. Las 24 reglas y 6 ecosistemas se inyectan como CONTEXTO en el prompt para guiar a Gemini, pero el LLM es libre de extender o desviarse cuando ve oportunidades que las reglas no cubren.

Caché por par `(ciiu_origen, ciiu_destino)`. Una segunda llamada con el mismo par NO invoca Gemini.

```typescript
import { Inject, Injectable } from '@nestjs/common'
import { GeminiPort } from '@/shared/domain/GeminiPort'
import { GEMINI_PORT } from '@/shared/shared.module'
import { CiiuTaxonomyRepository } from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import { CIIU_TAXONOMY_REPOSITORY } from '@/ciiu-taxonomy/ciiu-taxonomy.module'
import { AiMatchCacheRepository } from '../../domain/repositories/AiMatchCacheRepository'
import { AI_MATCH_CACHE_REPOSITORY } from '../../recommendations.module'
import {
  RelationType,
  isRelationType,
} from '../../domain/value-objects/RelationType'
import { VALUE_CHAIN_RULES, ECOSYSTEMS } from './ValueChainRules'

export interface InferredMatch {
  hasMatch: boolean
  relationType: RelationType | null
  confidence: number // 0..1
  reason: string
}

@Injectable()
export class AiMatchEngine {
  constructor(
    @Inject(GEMINI_PORT) private readonly gemini: GeminiPort,
    @Inject(AI_MATCH_CACHE_REPOSITORY)
    private readonly cache: AiMatchCacheRepository,
    @Inject(CIIU_TAXONOMY_REPOSITORY)
    private readonly ciiuRepo: CiiuTaxonomyRepository,
  ) {}

  /**
   * Evalúa un par CIIU. Devuelve cached si existe, o llama a Gemini con CONTEXTO
   * de rules + ecosystems relevantes para ese par.
   */
  async evaluate(
    ciiuOrigen: string,
    ciiuDestino: string,
  ): Promise<InferredMatch> {
    if (ciiuOrigen === ciiuDestino) {
      // Mismo CIIU → automáticamente referente, no hace falta llamar a Gemini
      const result: InferredMatch = {
        hasMatch: true,
        relationType: 'referente',
        confidence: 0.85,
        reason:
          'Misma actividad económica — referentes mutuos del mismo sector',
      }
      await this.cache.put({
        ciiuOrigen,
        ciiuDestino,
        ...result,
        hasMatch: true,
      })
      return result
    }

    const cached = await this.cache.get(ciiuOrigen, ciiuDestino)
    if (cached) {
      return {
        hasMatch: cached.hasMatch,
        relationType: cached.relationType,
        confidence: cached.confidence ?? 0,
        reason: cached.reason ?? '',
      }
    }

    const [origen, destino] = await Promise.all([
      this.ciiuRepo.findByCode(ciiuOrigen),
      this.ciiuRepo.findByCode(ciiuDestino),
    ])
    if (!origen || !destino) {
      const result: InferredMatch = {
        hasMatch: false,
        relationType: null,
        confidence: 0,
        reason: 'No DIAN data for one or both CIIUs',
      }
      await this.cache.put({ ciiuOrigen, ciiuDestino, ...result })
      return result
    }

    // Filtrar reglas que aplican a este par (en cualquier dirección)
    const applicableRules = VALUE_CHAIN_RULES.filter(
      (r) =>
        (r.ciiuOrigen === ciiuOrigen &&
          (r.ciiuDestino === ciiuDestino || r.ciiuDestino === '*')) ||
        (r.ciiuOrigen === ciiuDestino &&
          (r.ciiuDestino === ciiuOrigen || r.ciiuDestino === '*')),
    )
    const applicableEcosystems = ECOSYSTEMS.filter(
      (e) =>
        e.ciiuCodes.includes(ciiuOrigen) && e.ciiuCodes.includes(ciiuDestino),
    )

    const rulesBlock =
      applicableRules.length > 0
        ? applicableRules
            .map(
              (r) =>
                `- CIIU ${r.ciiuOrigen} → CIIU ${r.ciiuDestino}: ${r.description} (peso ${r.weight})`,
            )
            .join('\n')
        : '(ninguna regla hardcoded aplica directamente — usa tu criterio)'

    const ecosystemsBlock =
      applicableEcosystems.length > 0
        ? applicableEcosystems
            .map(
              (e) =>
                `- Ecosistema "${e.name}": ${e.description}. CIIUs miembros: ${e.ciiuCodes.join(', ')}`,
            )
            .join('\n')
        : '(no comparten ecosistema hardcoded — usa tu criterio)'

    const prompt = `Sos un analista de negocios colombiano experto en cadenas de valor del Magdalena.

CONOCIMIENTO PREVIO (úsalo como GUÍA, podés extender o desviar si ves algo razonable):

Reglas conocidas que aplican a este par:
${rulesBlock}

Ecosistemas que comparten estos CIIUs:
${ecosystemsBlock}

PAR A EVALUAR:
- Actividad A (origen): CIIU ${origen.code} — ${origen.titulo}
  Sección: ${origen.seccion} (${origen.tituloSeccion})
  División: ${origen.division} (${origen.tituloDivision})
- Actividad B (destino): CIIU ${destino.code} — ${destino.titulo}
  Sección: ${destino.seccion} (${destino.tituloSeccion})
  División: ${destino.division} (${destino.tituloDivision})

TAREA: ¿Tiene sentido recomendarle a una empresa con CIIU ${origen.code} otra empresa con CIIU ${destino.code}? Si sí, ¿qué tipo de relación tendrían?

REGLAS DE TIPO:
- "referente": misma o muy similar actividad → sirven de referencia mutua
- "cliente": A le VENDE su producto/servicio a B
- "proveedor": A le COMPRA su producto/servicio a B
- "aliado": sirven al MISMO cliente final, complementarios horizontalmente, no se compiten
- null: no hay relación de negocio razonable

CONFIDENCE:
- 0.85+ si la relación es muy clara y común en Colombia
- 0.65-0.85 si es razonable pero depende del subsegmento
- 0.5-0.65 si es plausible pero menos común
- < 0.5 → marcá has_match: false

Responde SOLO con JSON, sin explicaciones adicionales, sin markdown:
{
  "has_match": true | false,
  "relation_type": "referente" | "cliente" | "proveedor" | "aliado" | null,
  "confidence": 0.0,
  "reason": "frase corta en español explicando POR QUÉ se relacionan (no copiar literal el título del CIIU)"
}`

    const result = await this.gemini.inferStructured<InferredMatch>(
      prompt,
      validateInferredMatch,
    )
    await this.cache.put({
      ciiuOrigen,
      ciiuDestino,
      hasMatch: result.hasMatch,
      relationType: result.relationType,
      confidence: result.confidence,
      reason: result.reason,
    })
    return result
  }
}

function validateInferredMatch(raw: unknown): InferredMatch {
  if (typeof raw !== 'object' || raw === null)
    throw new Error('expected object')
  const r = raw as Record<string, unknown>
  return {
    hasMatch: r.has_match === true,
    relationType:
      typeof r.relation_type === 'string' && isRelationType(r.relation_type)
        ? r.relation_type
        : null,
    confidence:
      typeof r.confidence === 'number'
        ? Math.max(0, Math.min(1, r.confidence))
        : 0,
    reason: typeof r.reason === 'string' ? r.reason : '',
  }
}
```

- [ ] **Step 1 (RED)**: Test usando `StubGeminiAdapter` + `InMemoryAiMatchCacheRepository`

```typescript
import { AiMatchEngine } from '@/recommendations/application/services/AiMatchEngine'
import { StubGeminiAdapter } from '@/shared/infrastructure/gemini/StubGeminiAdapter'
import { InMemoryAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'

describe('AiMatchEngine', () => {
  it('short-circuits to "referente" when ciiuOrigen === ciiuDestino without calling Gemini', async () => {
    const gemini = new StubGeminiAdapter('', { has_match: true })
    const spy = vi.spyOn(gemini, 'inferStructured')
    const engine = new AiMatchEngine(
      gemini,
      new InMemoryAiMatchCacheRepository(),
      new InMemoryCiiuTaxonomyRepository(),
    )
    const r = await engine.evaluate('5611', '5611')
    expect(r.relationType).toBe('referente')
    expect(r.hasMatch).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('uses cache on second call with same pair', async () => {
    const gemini = new StubGeminiAdapter('', {
      has_match: true,
      relation_type: 'cliente',
      confidence: 0.85,
      reason: 'mayorista vende a restaurante',
    })
    const cache = new InMemoryAiMatchCacheRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
      CiiuActivity.create({
        code: '4631',
        titulo: 'Mayorista alimentos',
        seccion: 'G',
        division: '46',
        grupo: '463',
        tituloSeccion: 'Comercio',
        tituloDivision: 'Mayorista',
        tituloGrupo: 'Alimentos',
      }),
      CiiuActivity.create({
        code: '5611',
        titulo: 'Restaurantes',
        seccion: 'I',
        division: '56',
        grupo: '561',
        tituloSeccion: 'Alojamiento',
        tituloDivision: 'Comidas',
        tituloGrupo: 'Restaurantes',
      }),
    ])
    const engine = new AiMatchEngine(gemini, cache, ciiuRepo)
    const spy = vi.spyOn(gemini, 'inferStructured')

    const r1 = await engine.evaluate('4631', '5611')
    expect(r1.hasMatch).toBe(true)
    expect(r1.relationType).toBe('cliente')
    expect(spy).toHaveBeenCalledTimes(1)

    const r2 = await engine.evaluate('4631', '5611')
    expect(r2.relationType).toBe('cliente')
    expect(spy).toHaveBeenCalledTimes(1) // no segunda llamada
  })

  it('returns no-match when CIIU not in DIAN taxonomy', async () => {
    const gemini = new StubGeminiAdapter('', { has_match: true })
    const engine = new AiMatchEngine(
      gemini,
      new InMemoryAiMatchCacheRepository(),
      new InMemoryCiiuTaxonomyRepository(),
    )
    const r = await engine.evaluate('9999', '8888')
    expect(r.hasMatch).toBe(false)
    expect(r.confidence).toBe(0)
  })

  it('includes applicable rules in the prompt as guidance', async () => {
    let capturedPrompt = ''
    const gemini = new StubGeminiAdapter('', {
      has_match: true,
      relation_type: 'cliente',
      confidence: 0.9,
      reason: 'x',
    })
    const originalInfer = gemini.inferStructured.bind(gemini)
    gemini.inferStructured = async (prompt: string, v: any) => {
      capturedPrompt = prompt
      return originalInfer(prompt, v)
    }
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
      CiiuActivity.create({
        code: '4631',
        titulo: 'Mayorista alimentos',
        seccion: 'G',
        division: '46',
        grupo: '463',
        tituloSeccion: 'X',
        tituloDivision: 'Y',
        tituloGrupo: 'Z',
      }),
      CiiuActivity.create({
        code: '5611',
        titulo: 'Restaurantes',
        seccion: 'I',
        division: '56',
        grupo: '561',
        tituloSeccion: 'X',
        tituloDivision: 'Y',
        tituloGrupo: 'Z',
      }),
    ])
    const engine = new AiMatchEngine(
      gemini,
      new InMemoryAiMatchCacheRepository(),
      ciiuRepo,
    )
    await engine.evaluate('4631', '5611')
    expect(capturedPrompt).toContain(
      'Mayorista de alimentos abastece restaurantes',
    )
  })
})
```

- [ ] **Step 2 (GREEN)**: Implementar

- [ ] **Step 3**: Commit

```bash
git commit -m "feat(recommendations): add AiMatchEngine as primary matcher with rules+ecosystems guidance"
```

---

## Task 5.7 — `CandidateSelector` service

**Archivos:**

- Crear: `src/brain/src/recommendations/application/services/CandidateSelector.ts`

> Para evitar O(n²) sobre 10k empresas, este servicio devuelve para cada empresa el conjunto de TARGET CANDIDATES con quienes vale la pena evaluar. La estrategia es:
>
> 1. Mismas división CIIU + mismo municipio (peer candidates)
> 2. CIIU presente en alguna regla de cadena de valor (origen o destino) que matchee con el CIIU de source
> 3. CIIU presente en algún ecosistema compartido con source
> 4. Top N por proximidad geográfica (mismo municipio sube prioridad)

```typescript
@Injectable()
export class CandidateSelector {
  /**
   * Devuelve para cada empresa source los CIIUs candidate (targets).
   * No genera pares de empresas — solo decide qué CIIUs vale la pena evaluar contra cuáles.
   */
  selectCiiuPairs(companies: Company[]): Set<string> {
    const distinctCiius = new Set(companies.map((c) => c.ciiu))
    const pairs = new Set<string>()

    for (const a of distinctCiius) {
      // Auto-pair (referente)
      pairs.add(canonicalPair(a, a))

      for (const b of distinctCiius) {
        if (a === b) continue

        // Misma división → peer candidate
        if (a.slice(0, 2) === b.slice(0, 2)) {
          pairs.add(canonicalPair(a, b))
          continue
        }

        // Aparece en alguna regla
        const inRules = VALUE_CHAIN_RULES.some(
          (r) =>
            (r.ciiuOrigen === a &&
              (r.ciiuDestino === b || r.ciiuDestino === '*')) ||
            (r.ciiuOrigen === b &&
              (r.ciiuDestino === a || r.ciiuDestino === '*')),
        )
        if (inRules) {
          pairs.add(canonicalPair(a, b))
          continue
        }

        // Comparte ecosistema
        const inEcosystem = ECOSYSTEMS.some(
          (e) => e.ciiuCodes.includes(a) && e.ciiuCodes.includes(b),
        )
        if (inEcosystem) {
          pairs.add(canonicalPair(a, b))
        }
      }
    }
    return pairs
  }

  /**
   * Para una empresa source, devuelve las companies target que son candidatas viables.
   * Limita a topN por proximidad (mismo municipio gana).
   */
  selectTargetCompanies(
    source: Company,
    allCompanies: Company[],
    cache: Map<string, { hasMatch: boolean }>, // por par CIIU
    topN: number = 30,
  ): Company[] {
    return allCompanies
      .filter((t) => t.id !== source.id)
      .filter(
        (t) => cache.get(canonicalPair(source.ciiu, t.ciiu))?.hasMatch === true,
      )
      .map((t) => ({ company: t, score: proximityScore(source, t) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((x) => x.company)
  }
}

function canonicalPair(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`
}

function proximityScore(a: Company, b: Company): number {
  let s = 0
  if (a.municipio === b.municipio) s += 0.5
  if (a.etapa === b.etapa) s += 0.3
  if (a.ciiuDivision === b.ciiuDivision) s += 0.2
  return s
}
```

- [ ] **Step 1 (RED)**: Test que dado 10 companies con 5 CIIUs distintos, devuelva un conjunto razonable de pares (al menos los pares que matchean reglas hardcoded + los de misma división)

- [ ] **Step 2 (GREEN)**: Implementar

- [ ] **Step 3**: Commit

```bash
git commit -m "feat(recommendations): add CandidateSelector for pair pre-filtering"
```

---

## Task 5.8 — `CiiuPairEvaluator` service (llena el cache de AI)

**Archivos:**

- Crear: `src/brain/src/recommendations/application/services/CiiuPairEvaluator.ts`

> Este servicio toma TODOS los pares CIIU del universo (entregados por `CandidateSelector.selectCiiuPairs`) y se asegura de que cada par esté evaluado en el cache. Para los que ya están cacheados, no hace nada. Para los que no, llama a `AiMatchEngine.evaluate(...)`.
>
> Usa **concurrencia limitada** (default 4 paralelas) para no saturar Gemini ni tirar rate limits.

```typescript
@Injectable()
export class CiiuPairEvaluator {
  constructor(
    private readonly aiEngine: AiMatchEngine,
    @Inject(AI_MATCH_CACHE_REPOSITORY)
    private readonly cache: AiMatchCacheRepository,
    private readonly logger = new Logger(CiiuPairEvaluator.name),
  ) {}

  /**
   * Evalúa todos los pares dados que NO estén ya en cache.
   * Devuelve estadísticas: total, cached, evaluated, errors.
   */
  async evaluateAll(
    pairs: Set<string>,
    options: {
      concurrency?: number
      onProgress?: (done: number, total: number) => void
    } = {},
  ): Promise<{
    total: number
    cached: number
    evaluated: number
    errors: number
  }> {
    const concurrency = options.concurrency ?? 4
    const stats = { total: pairs.size, cached: 0, evaluated: 0, errors: 0 }
    const queue = Array.from(pairs)

    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const pair = queue.shift()
        if (!pair) break
        const [a, b] = pair.split('|')
        try {
          const existing = await this.cache.get(a, b)
          if (existing) {
            stats.cached++
          } else {
            await this.aiEngine.evaluate(a, b)
            stats.evaluated++
          }
        } catch (e: any) {
          stats.errors++
          this.logger.warn(`Failed to evaluate pair ${pair}: ${e.message}`)
        }
        if (options.onProgress)
          options.onProgress(
            stats.cached + stats.evaluated + stats.errors,
            stats.total,
          )
      }
    })

    await Promise.all(workers)
    return stats
  }
}
```

- [ ] **Step 1 (RED)**: Test con 10 pares, verificar que llama AiMatchEngine solo para los no-cacheados, respeta concurrencia

- [ ] **Step 2 (GREEN)**: Implementar

- [ ] **Step 3**: Commit

```bash
git commit -m "feat(recommendations): add CiiuPairEvaluator with concurrency-limited AI calls"
```

---

## Task 5.9 — `FeatureVectorBuilder` service (utility)

**Archivos:**

- Crear: `src/brain/src/recommendations/application/services/FeatureVectorBuilder.ts`

Construye vector de features para usar en `PeerMatcher` (fallback) y para boost de proximidad.

```typescript
export interface CompanyVector {
  ciiuClase: string
  ciiuDivision: string
  ciiuSeccion: string
  municipio: string
  etapaOrdinal: number // 1..4
  personalLog: number // log10(personal+1) normalizado a 0..1
  ingresoLog: number
}

@Injectable()
export class FeatureVectorBuilder {
  build(c: Company): CompanyVector {
    /* ... */
  }
  proximity(a: CompanyVector, b: CompanyVector): number {
    let s = 0
    if (a.municipio === b.municipio) s += 0.4
    if (a.etapaOrdinal === b.etapaOrdinal) s += 0.3
    s += (1 - Math.abs(a.personalLog - b.personalLog)) * 0.2
    s += (1 - Math.abs(a.ingresoLog - b.ingresoLog)) * 0.1
    return Math.min(s, 1)
  }
}
```

- [ ] Tests + commit

```bash
git commit -m "feat(recommendations): add FeatureVectorBuilder utility for proximity scoring"
```

---

## Task 5.10 — `PeerMatcher` service (FALLBACK)

> Solo se invoca si AI está deshabilitada o falla. Mantiene la lógica de cosine similarity dentro de la misma división CIIU.

(Implementación igual a la propuesta original — cosine similarity + structured reasons. Marcar `source: 'cosine'` en las recomendaciones generadas.)

- [ ] Test con 6 empresas fixture (3 panaderías SM, 2 panaderías Ciénaga, 1 hotel SM): verificar que panaderías se recomiendan entre sí
- [ ] Commit

```bash
git commit -m "feat(recommendations): add PeerMatcher (fallback) with cosine + structured reasons"
```

---

## Task 5.11 — `ValueChainMatcher` service (FALLBACK)

> Solo se invoca si AI está deshabilitada o falla. Genera recomendaciones cliente/proveedor desde las 24 reglas hardcoded.

```typescript
@Injectable()
export class ValueChainMatcher {
  match(companies: Company[]): Map<string, Recommendation[]> {
    const byCiiu = new Map<string, Company[]>()
    for (const c of companies) {
      const arr = byCiiu.get(c.ciiu) ?? []
      arr.push(c)
      byCiiu.set(c.ciiu, arr)
    }

    const out = new Map<string, Recommendation[]>()
    for (const rule of VALUE_CHAIN_RULES) {
      const sources = byCiiu.get(rule.ciiuOrigen) ?? []
      const targets =
        rule.ciiuDestino === '*'
          ? companies.filter((c) => c.ciiu !== rule.ciiuOrigen)
          : (byCiiu.get(rule.ciiuDestino) ?? [])

      for (const s of sources) {
        for (const t of targets) {
          if (s.id === t.id) continue
          const score = rule.weight * (s.municipio === t.municipio ? 1.0 : 0.85)
          appendTo(
            out,
            s.id,
            Recommendation.create({
              sourceCompanyId: s.id,
              targetCompanyId: t.id,
              relationType: 'cliente',
              score,
              reasons: Reasons.empty().add({
                feature: 'cadena_valor_directa',
                weight: rule.weight,
                description: rule.description,
              }),
              source: 'rule',
            }),
          )
          appendTo(
            out,
            t.id,
            Recommendation.create({
              sourceCompanyId: t.id,
              targetCompanyId: s.id,
              relationType: 'proveedor',
              score,
              reasons: Reasons.empty().add({
                feature: 'cadena_valor_inversa',
                weight: rule.weight,
                description: rule.description,
              }),
              source: 'rule',
            }),
          )
        }
      }
    }
    return out
  }
}
```

- [ ] Tests + Commit

```bash
git commit -m "feat(recommendations): add ValueChainMatcher (fallback) generating cliente/proveedor recs"
```

---

## Task 5.12 — `AllianceMatcher` service (FALLBACK)

> Solo se invoca si AI está deshabilitada o falla. Genera recomendaciones aliado desde los 6 ecosistemas.

```typescript
@Injectable()
export class AllianceMatcher {
  match(companies: Company[]): Map<string, Recommendation[]> {
    const byCiiu = new Map<string, Company[]>()
    for (const c of companies) {
      const arr = byCiiu.get(c.ciiu) ?? []
      arr.push(c)
      byCiiu.set(c.ciiu, arr)
    }

    const out = new Map<string, Recommendation[]>()
    for (const eco of ECOSYSTEMS) {
      const members = eco.ciiuCodes.flatMap((code) => byCiiu.get(code) ?? [])
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i],
            b = members[j]
          if (a.ciiu === b.ciiu) continue
          if (a.id === b.id) continue
          const score = a.municipio === b.municipio ? 0.75 : 0.55
          const reasons = Reasons.empty().add({
            feature: 'ecosistema_compartido',
            weight: 0.5,
            value: eco.id,
            description: `Ambas en el ecosistema ${eco.name}`,
          })
          appendTo(
            out,
            a.id,
            Recommendation.create({
              sourceCompanyId: a.id,
              targetCompanyId: b.id,
              relationType: 'aliado',
              score,
              reasons,
              source: 'ecosystem',
            }),
          )
          appendTo(
            out,
            b.id,
            Recommendation.create({
              sourceCompanyId: b.id,
              targetCompanyId: a.id,
              relationType: 'aliado',
              score,
              reasons,
              source: 'ecosystem',
            }),
          )
        }
      }
    }
    return out
  }
}
```

- [ ] Test + Commit

```bash
git commit -m "feat(recommendations): add AllianceMatcher (fallback) using 6 ecosystems"
```

---

## Task 5.13 — `GenerateRecommendations` use case (AI-first orchestration)

**Archivos:**

- Crear: `src/brain/src/recommendations/application/use-cases/GenerateRecommendations.ts`

> **Flujo principal AI-first:**
>
> 1. Cargar todas las companies activas
> 2. `CandidateSelector.selectCiiuPairs(companies)` → conjunto de pares CIIU a evaluar
> 3. `CiiuPairEvaluator.evaluateAll(pairs)` → asegura que el cache está lleno (llama AI solo para los no-cacheados)
> 4. Para cada empresa source, expandir candidatos usando el cache:
>    - Para cada otra empresa target, leer `cache.get(source.ciiu, target.ciiu)`
>    - Si `has_match` y `confidence >= MIN_CONFIDENCE` (default 0.5), crear Recommendation con `score = confidence × proximity_boost(source, target)`
> 5. Si AI deshabilitada (env `AI_MATCH_INFERENCE_ENABLED=false`) o cache totalmente vacío + AI falla → fallback a los 3 matchers hardcoded
> 6. Dedupe (mismo source+target+type, ganar mayor score) + limit (top 5 por tipo, top 20 total por empresa)
> 7. Persistir con `recRepo.deleteAll()` + `saveAll`
> 8. Retornar stats

```typescript
@Injectable()
export class GenerateRecommendations implements UseCase<
  { enableAi?: boolean },
  GenerateRecommendationsResult
> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    @Inject(AI_MATCH_CACHE_REPOSITORY)
    private readonly cache: AiMatchCacheRepository,
    private readonly candidateSelector: CandidateSelector,
    private readonly ciiuPairEvaluator: CiiuPairEvaluator,
    private readonly featureBuilder: FeatureVectorBuilder,
    // fallbacks
    private readonly peer: PeerMatcher,
    private readonly valueChain: ValueChainMatcher,
    private readonly alliance: AllianceMatcher,
    private readonly logger = new Logger(GenerateRecommendations.name),
  ) {}

  private static readonly MIN_CONFIDENCE = 0.5
  private static readonly TOP_PER_TYPE = 5
  private static readonly TOP_TOTAL = 20

  async execute(
    input: { enableAi?: boolean } = {},
  ): Promise<GenerateRecommendationsResult> {
    const aiEnabled =
      input.enableAi !== false && env.AI_MATCH_INFERENCE_ENABLED === 'true'
    const companies = (await this.companyRepo.findAll()).filter(
      (c) => c.estado === 'ACTIVO',
    )

    let recsBySource = new Map<string, Recommendation[]>()

    if (aiEnabled) {
      try {
        const pairs = this.candidateSelector.selectCiiuPairs(companies)
        const stats = await this.ciiuPairEvaluator.evaluateAll(pairs, {
          concurrency: 4,
          onProgress: (d, t) => {
            if (d % 50 === 0) this.logger.log(`AI eval ${d}/${t}`)
          },
        })
        this.logger.log(`AI eval stats: ${JSON.stringify(stats)}`)
        recsBySource = await this.expandFromCache(companies)
      } catch (e: any) {
        this.logger.error(
          `AI orchestration failed: ${e.message} — falling back to hardcoded matchers`,
        )
        recsBySource = this.runFallback(companies)
      }
    } else {
      this.logger.log('AI disabled — using hardcoded matchers')
      recsBySource = this.runFallback(companies)
    }

    const limited = this.limit(this.dedupe(recsBySource))
    await this.recRepo.deleteAll()
    await this.recRepo.saveAll(flatten(limited))
    return computeStats(limited)
  }

  private async expandFromCache(
    companies: Company[],
  ): Promise<Map<string, Recommendation[]>> {
    // Cargar TODO el cache en memoria una vez
    const allEntries = await this.cache.findAll()
    const cacheMap = new Map<string, AiMatchCacheEntry>()
    for (const e of allEntries) {
      cacheMap.set(canonicalPair(e.ciiuOrigen, e.ciiuDestino), e)
    }

    const out = new Map<string, Recommendation[]>()
    const byCiiu = groupBy(companies, (c) => c.ciiu)
    const vectors = new Map(
      companies.map((c) => [c.id, this.featureBuilder.build(c)]),
    )

    for (const source of companies) {
      const sourceVec = vectors.get(source.id)!
      for (const [targetCiiu, candidates] of byCiiu) {
        const entry = cacheMap.get(canonicalPair(source.ciiu, targetCiiu))
        if (!entry || !entry.hasMatch) continue
        if ((entry.confidence ?? 0) < GenerateRecommendations.MIN_CONFIDENCE)
          continue

        for (const target of candidates) {
          if (target.id === source.id) continue
          const targetVec = vectors.get(target.id)!
          const proximity = this.featureBuilder.proximity(sourceVec, targetVec)
          const score = (entry.confidence ?? 0) * (0.6 + 0.4 * proximity) // 60% AI, 40% proximidad

          // El relation_type viene del cache, pero hay que invertir si el orden CIIU se invirtió
          const relationType =
            source.ciiu <= targetCiiu
              ? entry.relationType!
              : inverseRelation(entry.relationType!)

          appendTo(
            out,
            source.id,
            Recommendation.create({
              sourceCompanyId: source.id,
              targetCompanyId: target.id,
              relationType,
              score,
              reasons: Reasons.empty()
                .add({
                  feature: 'ai_inferido',
                  weight: entry.confidence!,
                  description: entry.reason ?? '',
                })
                .add({
                  feature: 'mismo_municipio',
                  weight: source.municipio === target.municipio ? 0.2 : 0,
                  value: source.municipio,
                  description:
                    source.municipio === target.municipio
                      ? `Ambas en ${source.municipio}`
                      : '',
                }),
              source: 'ai-inferred',
            }),
          )
        }
      }
    }
    return out
  }

  private runFallback(companies: Company[]): Map<string, Recommendation[]> {
    const out = new Map<string, Recommendation[]>()
    mergeInto(
      out,
      this.peer.match(companies, GenerateRecommendations.TOP_PER_TYPE),
    )
    mergeInto(out, this.valueChain.match(companies))
    mergeInto(out, this.alliance.match(companies))
    return out
  }

  private dedupe(
    recs: Map<string, Recommendation[]>,
  ): Map<string, Recommendation[]> {
    /* ... */
  }
  private limit(
    recs: Map<string, Recommendation[]>,
  ): Map<string, Recommendation[]> {
    /* ... */
  }
}
```

- [ ] **Step 1**: Test E2E con 20 empresas fixture y `StubGeminiAdapter`:
  - Hay recs de los 4 tipos
  - Ninguna empresa tiene > 20 recs totales
  - Ninguna empresa tiene > 5 recs por tipo
  - El `source` de las recs es `'ai-inferred'` cuando AI estaba activo
  - Si seteamos `AI_MATCH_INFERENCE_ENABLED='false'`, el `source` es `'cosine'|'rule'|'ecosystem'`

- [ ] **Step 2**: Test de fallback:
  - Inyectar un `AiMatchEngine` que tira error → verificar que recs se generan via hardcoded matchers
  - El log debe mostrar el error + el fallback

- [ ] **Step 3-4**: Implementar + Commit

```bash
git commit -m "feat(recommendations): add GenerateRecommendations AI-first with hardcoded fallback"
```

---

## Task 5.14 — `GetCompanyRecommendations` use case

```typescript
@Injectable()
export class GetCompanyRecommendations implements UseCase<
  { companyId: string; type?: RelationType; limit?: number },
  { recommendations: RecommendationDto[] }
> {
  constructor(
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
  ) {}

  async execute(input: {
    companyId: string
    type?: RelationType
    limit?: number
  }) {
    const limit = input.limit ?? 10
    const recs = input.type
      ? await this.recRepo.findBySourceAndType(
          input.companyId,
          input.type,
          limit,
        )
      : await this.recRepo.findBySource(input.companyId, limit)

    // Hidratar datos de la empresa target
    const targetIds = recs.map((r) => r.targetCompanyId)
    const targets = await Promise.all(
      targetIds.map((id) => this.companyRepo.findById(id)),
    )
    const targetMap = new Map(targets.filter(Boolean).map((c) => [c!.id, c!]))

    return {
      recommendations: recs.map((r) => ({
        id: r.id,
        targetCompany: targetMap.get(r.targetCompanyId)
          ? toDto(targetMap.get(r.targetCompanyId)!)
          : null,
        relationType: r.relationType,
        score: r.score,
        reasons: r.reasons.toJson(),
        source: r.source,
        explanation: r.explanation, // null si no se ha enriquecido
      })),
    }
  }
}
```

- [ ] Test + Commit

```bash
git commit -m "feat(recommendations): add GetCompanyRecommendations with target hydration"
```

---

## Task 5.15 — `ExplainRecommendation` use case (Gemini lazy + cache)

```typescript
@Injectable()
export class ExplainRecommendation implements UseCase<
  { recommendationId: string },
  { explanation: string }
> {
  constructor(
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
    @Inject(GEMINI_PORT) private readonly gemini: GeminiPort,
  ) {}

  async execute(input: { recommendationId: string }) {
    const rec = await this.recRepo.findById(input.recommendationId)
    if (!rec) throw new Error('Recommendation not found')
    if (rec.explanation) return { explanation: rec.explanation }

    const [source, target] = await Promise.all([
      this.companyRepo.findById(rec.sourceCompanyId),
      this.companyRepo.findById(rec.targetCompanyId),
    ])
    if (!source || !target) throw new Error('Companies not found')

    const prompt = `Sos un asesor empresarial. Explicá en 2-3 frases por qué la empresa "${source.razonSocial}" (CIIU ${source.ciiu}, ${source.municipio}) podría conectarse con "${target.razonSocial}" (CIIU ${target.ciiu}, ${target.municipio}) como ${rec.relationType}.

Razones estructuradas detectadas: ${JSON.stringify(rec.reasons.toJson())}

Tono: profesional pero cercano, en español. Termina con un siguiente paso concreto que el empresario debería hacer.`

    const explanation = await this.gemini.generateText(prompt)
    await this.recRepo.updateExplanation(rec.id, explanation)
    return { explanation }
  }
}
```

- [ ] Test con `StubGeminiAdapter` + commit

```bash
git commit -m "feat(recommendations): add ExplainRecommendation with lazy Gemini + cache"
```

---

## Task 5.16 — `RecommendationsController` + Module

Endpoints:

- `GET /api/companies/:id/recommendations?type=cliente&limit=10`
- `POST /api/recommendations/:id/explain` → dispara/retorna `ExplainRecommendation`
- `POST /api/recommendations/generate` → dispara `GenerateRecommendations` (mantener manual además del cron)

- [ ] Implementar + Commit

```bash
git commit -m "feat(recommendations): add HTTP controller and module"
```

---

# Phase 6 — Agent Context

## Task 6.1 — `ScanRun` y `AgentEvent` entities

**Archivos:**

- `src/brain/src/agent/domain/entities/ScanRun.ts`
- `src/brain/src/agent/domain/entities/AgentEvent.ts`
- `src/brain/src/agent/domain/value-objects/EventType.ts`

```typescript
// EventType.ts
export const EVENT_TYPES = [
  'new_high_score_match',
  'new_value_chain_partner',
  'new_cluster_member',
] as const
export type EventType = (typeof EVENT_TYPES)[number]
```

```typescript
// ScanRun.ts
export class ScanRun extends Entity<string> {
  // props: startedAt, completedAt, companiesScanned, clustersGenerated, recommendationsGenerated, eventsEmitted, status, trigger, errorMessage, durationMs

  static start(data: { id: string; trigger: 'cron' | 'manual' }): ScanRun { ... }
  complete(stats: { ... }): ScanRun { ... }   // returns new instance with status='completed'
  fail(message: string): ScanRun { ... }
  partial(stats: { ... }, message: string): ScanRun { ... }
}
```

```typescript
// AgentEvent.ts
export class AgentEvent extends Entity<string> {
  // props: companyId, eventType, payload (Record<string, unknown>), read, createdAt
  static create(data: {...}): AgentEvent { ... }
  markAsRead(): AgentEvent { ... }
}
```

- [ ] Test + Commit

```bash
git commit -m "feat(agent): add ScanRun and AgentEvent entities with state transitions"
```

---

## Task 6.2 — `ScanRunRepository` + `AgentEventRepository`

Mismo patrón: port + Supabase + InMemory.

```typescript
interface ScanRunRepository {
  save(run: ScanRun): Promise<void>
  findLatest(): Promise<ScanRun | null>
  findLatestCompleted(): Promise<ScanRun | null> // KEY: para polling
  countByStatus(status: string): Promise<number>
}

interface AgentEventRepository {
  saveAll(events: AgentEvent[]): Promise<void>
  findByCompany(
    companyId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ): Promise<AgentEvent[]>
  markAsRead(eventId: string): Promise<void>
  countUnreadForCompany(companyId: string): Promise<number>
}
```

- [ ] Tests + Commits

```bash
git commit -m "feat(agent): add scan run and event repository ports + adapters"
```

---

## Task 6.3 — `OpportunityDetector` service

Compara recomendaciones generadas en este scan vs. las del último scan completado. Genera AgentEvents para:

- **new_high_score_match**: nueva recomendación con score > 0.75 que no existía antes
- **new_value_chain_partner**: nueva recomendación de tipo `cliente` o `proveedor` con score > 0.65
- **new_cluster_member**: empresa nueva agregada a un cluster en el que la empresa ya estaba

```typescript
@Injectable()
export class OpportunityDetector {
  detect(
    newRecs: Recommendation[],
    previousRecIds: Set<string>, // ids del scan anterior
    newClusterMemberships: Map<string, string[]>, // clusterId -> companyIds nuevos
    existingMemberships: Map<string, string[]>,
  ): AgentEvent[] {
    const events: AgentEvent[] = []

    for (const rec of newRecs) {
      const recKey = `${rec.sourceCompanyId}|${rec.targetCompanyId}|${rec.relationType}`
      if (previousRecIds.has(recKey)) continue // ya existía

      if (rec.score >= 0.75) {
        events.push(
          AgentEvent.create({
            id: uuid(),
            companyId: rec.sourceCompanyId,
            eventType: 'new_high_score_match',
            payload: {
              recommendationId: rec.id,
              targetId: rec.targetCompanyId,
              score: rec.score,
              type: rec.relationType,
            },
          }),
        )
      } else if (
        (rec.relationType === 'cliente' || rec.relationType === 'proveedor') &&
        rec.score >= 0.65
      ) {
        events.push(
          AgentEvent.create({
            id: uuid(),
            companyId: rec.sourceCompanyId,
            eventType: 'new_value_chain_partner',
            payload: {
              recommendationId: rec.id,
              targetId: rec.targetCompanyId,
              type: rec.relationType,
            },
          }),
        )
      }
    }

    // new_cluster_member: si una empresa existente comparte cluster con una nueva
    for (const [clusterId, newMembers] of newClusterMemberships) {
      const existingMembers = existingMemberships.get(clusterId) ?? []
      for (const existing of existingMembers) {
        for (const newMember of newMembers) {
          if (existing === newMember) continue
          events.push(
            AgentEvent.create({
              id: uuid(),
              companyId: existing,
              eventType: 'new_cluster_member',
              payload: { clusterId, newCompanyId: newMember },
            }),
          )
        }
      }
    }

    return events
  }
}
```

- [ ] Test + Commit

```bash
git commit -m "feat(agent): add OpportunityDetector for event generation"
```

---

## Task 6.4 — `RunIncrementalScan` use case (la orquestación agéntica)

El corazón del agente. Polling inteligente con **sync desde la fuente externa primero** (CSV hoy, BigQuery mañana — sin tocar este código):

```typescript
@Injectable()
export class RunIncrementalScan implements UseCase<
  { trigger: 'cron' | 'manual' },
  ScanRunResult
> {
  constructor(
    @Inject(SCAN_RUN_REPOSITORY) private readonly scanRepo: ScanRunRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
    private readonly syncCompanies: SyncCompaniesFromSource, // ← inyectado del Companies context
    private readonly generateClusters: GenerateClusters,
    private readonly generateRecs: GenerateRecommendations,
    private readonly detector: OpportunityDetector,
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    @Inject(AGENT_EVENT_REPOSITORY)
    private readonly eventRepo: AgentEventRepository,
    @Inject(CLUSTER_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: ClusterMembershipRepository,
  ) {}

  async execute(input: { trigger: 'cron' | 'manual' }): Promise<ScanRunResult> {
    const id = randomUUID()
    let run = ScanRun.start({ id, trigger: input.trigger })
    await this.scanRepo.save(run)

    try {
      const last = await this.scanRepo.findLatestCompleted()
      const since = last?.completedAt ?? new Date(0)

      // (1) Sync desde la fuente externa (CompanySource port).
      //     HOY: CsvCompanySource → lee REGISTRADOS_SII.csv
      //     MAÑANA (con creds del reto): BigQueryCompanySource → query incremental a BQ
      //     El agente NO se entera de cuál corre — eso lo decide el module.
      await this.syncCompanies.execute({ since })

      // (2) ¿Hay empresas nuevas o modificadas en Supabase tras el sync?
      const updated = await this.companyRepo.findUpdatedSince(since)
      if (updated.length === 0 && last !== null) {
        // No hay nada nuevo — solo registrar el scan vacío
        run = run.complete({
          companiesScanned: 0,
          clustersGenerated: 0,
          recommendationsGenerated: 0,
          eventsEmitted: 0,
        })
        await this.scanRepo.save(run)
        return { runId: id, status: 'completed', companiesScanned: 0 }
      }

      // (3) Snapshot del estado anterior para detectar cambios
      const previousRecs = await this.recRepo.snapshotKeys() // Set<sourceId|targetId|type>
      const previousMemberships = await this.membershipRepo.snapshot()

      // (4) Regenerar clusters
      const clusterStats = await this.generateClusters.execute()

      // (5) Regenerar recomendaciones
      const recStats = await this.generateRecs.execute({})

      // (6) Detectar oportunidades
      const newRecs = await this.recRepo.findAll()
      const newMemberships = await this.membershipRepo.snapshot()
      const events = this.detector.detect(
        newRecs,
        previousRecs,
        diff(newMemberships, previousMemberships),
        previousMemberships,
      )
      await this.eventRepo.saveAll(events)

      run = run.complete({
        companiesScanned: updated.length,
        clustersGenerated: clusterStats.totalClusters,
        recommendationsGenerated: recStats.total,
        eventsEmitted: events.length,
      })
      await this.scanRepo.save(run)
      return { runId: id, status: 'completed' /* ... */ }
    } catch (e: any) {
      run = run.fail(e.message)
      await this.scanRepo.save(run)
      throw e
    }
  }
}
```

> **Patrón clave:** El agente delega el "de dónde vienen las empresas" al port `CompanySource` (vía `SyncCompaniesFromSource`). Cuando el reto entregue las credenciales de BigQuery, **agregar `BigQueryCompanySource` y cambiar UNA línea** en `companies.module.ts`. Este use case NO se modifica, los tests siguen pasando, el cron sigue corriendo.

- [ ] **Step 1**: Test E2E con InMemory repos para todo

- [ ] **Step 2-3**: Implementar + Commit

```bash
git commit -m "feat(agent): add RunIncrementalScan with polling and opportunity detection"
```

---

## Task 6.5 — `AgentScheduler` con `@Cron`

**Archivos:**

- `src/brain/src/agent/infrastructure/scheduler/AgentScheduler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { env } from '@/shared/infrastructure/env'
import { RunIncrementalScan } from '../../application/use-cases/RunIncrementalScan'

@Injectable()
export class AgentScheduler {
  private readonly logger = new Logger(AgentScheduler.name)
  private isRunning = false

  constructor(private readonly runScan: RunIncrementalScan) {}

  // Decorador estático — pero la expresión se lee del env al boot
  @Cron(env.AGENT_CRON_SCHEDULE, { name: 'agent-incremental-scan' })
  async handleScan() {
    if (env.AGENT_ENABLED === 'false') return
    if (this.isRunning) {
      this.logger.warn('Previous scan still running, skipping this tick')
      return
    }

    this.isRunning = true
    try {
      const t0 = Date.now()
      const result = await this.runScan.execute({ trigger: 'cron' })
      const dt = Date.now() - t0
      this.logger.log(`Scan completed in ${dt}ms: ${JSON.stringify(result)}`)
    } catch (e: any) {
      this.logger.error(`Scan failed: ${e.message}`, e.stack)
    } finally {
      this.isRunning = false
    }
  }
}
```

- [ ] **Step 1**: Test (mockear `RunIncrementalScan`, llamar `handleScan()` directamente sin esperar el cron)

- [ ] **Step 2**: Commit

```bash
git commit -m "feat(agent): add AgentScheduler with @Cron decorator and re-entry guard"
```

---

## Task 6.6 — Use cases adicionales: `GetAgentEvents`, `MarkEventAsRead`

Triviales — wrappers sobre el repositorio.

- [ ] Tests + Commit

---

## Task 6.7 — `AgentController` + `AgentModule`

Endpoints:

- `POST /api/agent/scan` → trigger manual de `RunIncrementalScan({ trigger: 'manual' })`
- `GET /api/agent/status` → última corrida + agregados (count by status)
- `GET /api/agent/events?companyId=X&unread=true&limit=20` → eventos por empresa
- `POST /api/agent/events/:id/read` → marcar como leído

- [ ] Implementar + Commit

```bash
git commit -m "feat(agent): add HTTP controller, module, and event endpoints"
```

---

# Phase 7 — Seeds (CSVs → Supabase)

## Task 7.1 — `seed-ciiu-taxonomy.ts`

**Archivos:**

- `src/brain/src/seeds/seed-ciiu-taxonomy.ts`

```typescript
import { CsvLoader } from '@/shared/infrastructure/csv/CsvLoader'
import { DataPaths } from '@/shared/infrastructure/path/DataPaths'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { createBrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'
import { SupabaseCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/SupabaseCiiuTaxonomyRepository'

export async function seedCiiuTaxonomy() {
  const rows = await CsvLoader.load<{
    code: string
    seccion: string
    division: string
    grupo: string
    titulo_actividad: string
    titulo_seccion: string
    titulo_division: string
    titulo_grupo: string
    macro_sector?: string
  }>(DataPaths.ciiuDianCsv)

  const activities = rows.map((r) =>
    CiiuActivity.create({
      code: r.code,
      titulo: r.titulo_actividad,
      seccion: r.seccion,
      division: r.division,
      grupo: r.grupo,
      tituloSeccion: r.titulo_seccion,
      tituloDivision: r.titulo_division,
      tituloGrupo: r.titulo_grupo,
      macroSector: r.macro_sector || null,
    }),
  )

  const repo = new SupabaseCiiuTaxonomyRepository(createBrainSupabaseClient())
  await repo.saveAll(activities)
  console.log(`✅ Seeded ${activities.length} CIIU activities`)
}
```

---

## Task 7.2 — `seed-companies.ts`

> **Refactor importante:** El seed YA NO parsea el CSV directamente. Delega al `CsvCompanySource` (creado en Task 3.7), que es el adapter de la fuente externa. El seed se vuelve un thin wrapper: `source.fetchAll()` → `repo.saveMany()`. Esto mantiene la lógica de mapeo CSV→`Company` en UN solo lugar (el adapter), reutilizable cuando el agente haga sync incremental (Task 6.4).
>
> **Cuando lleguen las creds de BigQuery del reto**, este seed corre exactamente igual — solo cambia el provider del `COMPANY_SOURCE` token en el module.

```typescript
// src/brain/src/seeds/seed-companies.ts
export async function seedCompanies() {
  const csvLoader = new CsvLoader()
  const etapaCalculator = new EtapaCalculator()
  const source = new CsvCompanySource(csvLoader, etapaCalculator)

  const companies = await source.fetchAll()

  const repo = new SupabaseCompanyRepository(createBrainSupabaseClient())
  await repo.saveMany(companies)

  console.log(
    `✅ Seeded ${companies.length} companies (source: CsvCompanySource)`,
  )
}
```

**Nota:** Toda la lógica de mapeo (`Company.create({...})` con los headers del CSV, `parseDateYYYYMMDD`, manejo de `skipped`) vive en `CsvCompanySource.toCompany()`. NO duplicar acá.

---

## Task 7.3 — `seed-predefined-clusters.ts` y `seed-cluster-mappings.ts`

`seed-predefined-clusters.ts` — carga `CLUSTERS.csv`:

```typescript
const rows = await CsvLoader.load(DataPaths.clustersCsv)
const clusters = rows
  .filter((r: any) => r.clusterESTADO === 'ACTIVO')
  .map((r: any) =>
    Cluster.create({
      id: `pred-${r.clusterID}`,
      codigo: r.clusterCODIGO,
      titulo: r.clusterTITULO,
      descripcion: r.clusterDESCRIPCION || null,
      tipo: 'predefined',
      macroSector: null,
      memberCount: 0,
    }),
  )
await repo.saveAll(clusters)
```

`seed-cluster-mappings.ts` — carga `CLUSTERS_ACTIVIDADESECONOMICAS.csv` y arma la tabla `cluster_ciiu_mapping`. El campo `ciiuID` del CSV es el internal ID de DIAN — necesitamos cruzarlo con `ciiu_taxonomy` para obtener el `code`. El cruce se hace via `CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv` que tiene `ciiuActividadID` + `ciiuActividadCODIGO`.

---

## Task 7.4 — `bootstrap-all.ts` (runner)

```typescript
import { seedCiiuTaxonomy } from './seed-ciiu-taxonomy'
import { seedCompanies } from './seed-companies'
import { seedPredefinedClusters } from './seed-predefined-clusters'
import { seedClusterMappings } from './seed-cluster-mappings'

async function main() {
  console.log('🚀 Bootstrapping brain database...')
  console.log('Step 1/4: CIIU DIAN taxonomy')
  await seedCiiuTaxonomy()
  console.log('Step 2/4: Companies')
  await seedCompanies()
  console.log('Step 3/4: Predefined clusters')
  await seedPredefinedClusters()
  console.log('Step 4/4: Cluster CIIU mappings')
  await seedClusterMappings()
  console.log('✅ Bootstrap complete')
}

main().catch((e) => {
  console.error('❌ Bootstrap failed:', e)
  process.exit(1)
})
```

Agregar al `package.json` del brain:

```json
"scripts": {
  "seed": "bun src/seeds/bootstrap-all.ts"
}
```

- [ ] **Step**: Implementar + correr `bun --filter brain seed` y verificar en Supabase Dashboard que las 4 tablas tienen datos.

- [ ] Commit:

```bash
git commit -m "feat(seeds): add bootstrap script that loads all CSVs into Supabase"
```

---

# Phase 8 — Wiring + E2E + README

## Task 8.1 — Importar todos los módulos en `AppModule`

```typescript
@Module({
  imports: [
    ScheduleModule.forRoot(),
    SharedModule,
    CiiuTaxonomyModule,
    CompaniesModule,
    ClustersModule,
    RecommendationsModule,
    AgentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] Verificar `bun --filter brain start:dev` arranca y `/docs` muestra los endpoints.

- [ ] Commit

---

## Task 8.2 — Test E2E del agente

**Archivos:**

- `__tests__/integration/agent-scan.test.ts`

Test que:

1. Setupea InMemory repos con 20 empresas fixture
2. Inserta 1 nueva empresa → marca su `updatedAt`
3. Ejecuta `RunIncrementalScan({ trigger: 'manual' })`
4. Verifica:
   - Status del run = 'completed'
   - Se generaron clusters con la nueva empresa
   - Se generaron recomendaciones para la nueva empresa
   - Se emitieron AgentEvents para empresas existentes que ahora comparten cluster

- [ ] Commit

```bash
git commit -m "test(integration): add E2E test for agent incremental scan"
```

---

## Task 8.3 — Actualizar `src/brain/README.md`

Agregar:

- Comando `bun --filter brain seed` antes de levantar el server
- Lista completa de endpoints (companies, clusters, recommendations, agent)
- Variables de entorno requeridas
- Cómo correr el cron en dev (variable `AGENT_CRON_SCHEDULE`)
- **Sección "Fuente de datos del reto"** — explicar el patrón `CompanySource`:
  - Hoy: `CsvCompanySource` lee `REGISTRADOS_SII.csv` (mock provisto por la Cámara antes del hackathon).
  - Mañana: cuando lleguen las credenciales de BigQuery del reto, agregar `BigQueryCompanySource` y cambiar `useClass` en `companies.module.ts`. Sin tocar domain ni use cases.
  - Esta sección también va en `docs/documentacion.md` (entregable del reto) — el jurado debe ver explícitamente que la arquitectura está preparada para la fuente real.

- [ ] Commit

```bash
git commit -m "docs(brain): update README with seed instructions, endpoints, and CompanySource pattern"
```

---

## Verification Checklist (post-implementation)

```bash
# 1. Schema aplicado
bunx supabase db diff --linked

# 2. Seeds corren sin error
bun --filter brain seed

# 3. Tests pasan
bun --filter brain test:run

# 4. Coverage > 80% en src/
bun --filter brain test:coverage

# 5. Server arranca
bun --filter brain start:dev

# 6. Health check
curl http://localhost:3001/api/health

# 7. Listar empresas
curl 'http://localhost:3001/api/companies?limit=5' | jq

# 8. Generar clusters manualmente
curl -X POST http://localhost:3001/api/clusters/generate | jq

# 9. Generar recomendaciones manualmente
curl -X POST http://localhost:3001/api/recommendations/generate | jq

# 10. Trigger del agente
curl -X POST http://localhost:3001/api/agent/scan | jq

# 11. Recomendaciones para una empresa
curl 'http://localhost:3001/api/companies/0123456-7/recommendations?limit=10' | jq

# 12. Eventos del agente para una empresa
curl 'http://localhost:3001/api/agent/events?companyId=0123456-7&unread=true' | jq

# 13. Ver el cron en acción (esperar 60s, los logs deben mostrar otra corrida)
bun --filter brain start:dev
# después de 60s ver "Scan completed in Xms"
```

---

## Notas

- **TDD discipline**: cada task que implementa lógica de negocio empieza con test failing. Los puertos sin lógica (interfaces) y los módulos NestJS (wiring) NO requieren test propio — se cubren por integración.
- **Coverage 80%**: el archivo `vitest.config.ts` ya tiene el threshold. `*.module.ts` y `main.ts` están excluidos.
- **AI calls en tests**: SIEMPRE usar `StubGeminiAdapter`. Los tests con API real solo corren si `GEMINI_API_KEY` está set (skipIf en describe).
- **Idempotencia del seed**: usa `upsert` con `onConflict: 'code'` (CIIU) o `'id'` (companies). Correr seed dos veces es seguro.
- **Re-entrancy del cron**: `AgentScheduler` tiene un guard `isRunning` para evitar overlap. Si un scan tarda más de 60s y llega el siguiente tick, este se salta con un log de warning.
- **Dedupe de recomendaciones**: cuando AI y fallback generan la misma recomendación (source/target/type), gana la de mayor score. Implementar en `GenerateRecommendations.dedupe()`.
- **AI es PRIMARIO, no opcional**: el sistema está diseñado AI-first. El `AiMatchEngine` con rules+ecosystems como guía produce los matches; los hardcoded matchers (`PeerMatcher`, `ValueChainMatcher`, `AllianceMatcher`) son **fallback** cuando AI falla o se desactiva via env.
- **AI cache primer scan**: la PRIMERA corrida del agente con la base completa hace ~5k-25k llamadas a Gemini para llenar el cache (depende de cuántos CIIUs distintos haya en los 10k registros). Costo estimado con `gemini-2.5-flash`: $1-3 USD. Las siguientes corridas son casi gratis (cache hit) salvo cuando aparezcan CIIUs nuevos.
- **Concurrencia AI**: `CiiuPairEvaluator` usa concurrencia 4 por default (configurable). Si Gemini tira rate limits, bajarlo a 2.
- **Mín confidence**: solo se materializan recomendaciones con `confidence >= 0.5` del cache. Configurable en `GenerateRecommendations.MIN_CONFIDENCE`.
- **Score final**: `score = ai_confidence × (0.6 + 0.4 × proximity)`. La AI provee la confianza del match a nivel CIIU; la proximidad (mismo municipio + misma etapa + tamaño similar) refina el ranking entre empresas con el mismo par CIIU.
- **Performance del expand**: para 10k empresas, leer todo el cache + expandir es O(n × m) donde m es el número de CIIUs distintos (~159) → 1.6M iteraciones. En memoria, < 5 segundos.
- **Idempotencia del scan**: cada corrida BORRA y RE-ESCRIBE recomendaciones (`recRepo.deleteAll()` + `saveAll`). El cache de AI **NUNCA se borra** — es la fuente de verdad acumulada. Para hackathon es aceptable.
- **Privacidad**: el .env tiene SUPABASE_SERVICE_ROLE_KEY (sensible). NUNCA commitear. Asegurarse que `.env` esté en `.gitignore` (ya está).
