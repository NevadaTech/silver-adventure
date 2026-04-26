-- =====================================================================
-- 0001_brain_init.sql
-- Initial schema for the Silver Adventure brain (clustering engine).
-- 8 tables + indexes + updated_at trigger.
-- =====================================================================

-- =====================================================================
-- 1) CIIU Taxonomy (DIAN)
-- =====================================================================
create table ciiu_taxonomy (
  code             text primary key,            -- '4711' (4 dígitos sin sección)
  seccion          char(1) not null,            -- 'G'
  division         text not null,               -- '47'
  grupo            text not null,               -- '471'
  titulo_actividad text not null,
  titulo_seccion   text not null,
  titulo_division  text not null,
  titulo_grupo     text not null,
  macro_sector     text                          -- nullable: 'Servicios', 'Manufacturas', etc.
);

create index idx_ciiu_seccion on ciiu_taxonomy(seccion);
create index idx_ciiu_division on ciiu_taxonomy(division);

-- =====================================================================
-- 2) Companies (10k empresas de REGISTRADOS_SII.csv)
-- =====================================================================
create table companies (
  id                text primary key,            -- registradoMATRICULA (string, hay guiones)
  razon_social      text not null,
  ciiu              text not null,               -- '4711' (sin sección)
  ciiu_seccion      char(1) not null,            -- 'G'
  ciiu_division     text not null,               -- '47'
  ciiu_grupo        text not null,               -- '471'
  municipio         text not null,
  tipo_organizacion text,
  personal          int default 0,
  ingreso_operacion numeric(20,2) default 0,
  activos_totales   numeric(20,2) default 0,
  email             text,
  telefono          text,
  direccion         text,
  fecha_matricula   date,
  fecha_renovacion  date,
  estado            text not null default 'ACTIVO',
  etapa             text not null,               -- 'nacimiento' | 'crecimiento' | 'consolidacion' | 'madurez'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
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
  id            text primary key,
  codigo        text not null,
  titulo        text not null,
  descripcion   text,
  tipo          text not null,                   -- 'predefined' | 'heuristic-division' | 'heuristic-grupo' | 'heuristic-municipio'
  ciiu_division text,
  ciiu_grupo    text,
  municipio     text,
  macro_sector  text,
  member_count  int not null default 0,
  generated_at  timestamptz not null default now()
);

create index idx_clusters_tipo on clusters(tipo);
create index idx_clusters_ciiu_division on clusters(ciiu_division);
create index idx_clusters_ciiu_grupo on clusters(ciiu_grupo);

-- N:M: una empresa puede pertenecer a múltiples clusters
create table cluster_members (
  cluster_id text not null references clusters(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (cluster_id, company_id)
);

create index idx_cluster_members_company on cluster_members(company_id);

-- Mapeo predefinido: cluster_id (predefined) → CIIU code
create table cluster_ciiu_mapping (
  cluster_id text not null references clusters(id) on delete cascade,
  ciiu_code  text not null,
  primary key (cluster_id, ciiu_code)
);

-- =====================================================================
-- 4) Recommendations
-- =====================================================================
create table recommendations (
  id                    uuid primary key default gen_random_uuid(),
  source_company_id     text not null references companies(id) on delete cascade,
  target_company_id     text not null references companies(id) on delete cascade,
  relation_type         text not null,           -- 'referente' | 'cliente' | 'proveedor' | 'aliado'
  score                 numeric(5,4) not null check (score >= 0 and score <= 1),
  reasons               jsonb not null default '[]'::jsonb,
  source                text not null,           -- 'rule' | 'cosine' | 'ecosystem' | 'ai-inferred'
  explanation           text,
  explanation_cached_at timestamptz,
  created_at            timestamptz not null default now(),
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
  relation_type text,
  confidence    numeric(5,4),
  reason        text,
  cached_at     timestamptz not null default now(),
  primary key (ciiu_origen, ciiu_destino)
);

-- =====================================================================
-- 5) Agent Scan Runs + Events
-- =====================================================================
create table scan_runs (
  id                        uuid primary key default gen_random_uuid(),
  started_at                timestamptz not null default now(),
  completed_at              timestamptz,
  companies_scanned         int not null default 0,
  clusters_generated        int not null default 0,
  recommendations_generated int not null default 0,
  events_emitted            int not null default 0,
  status                    text not null,        -- 'running' | 'completed' | 'failed' | 'partial'
  trigger                   text not null,        -- 'cron' | 'manual'
  error_message             text,
  duration_ms               int
);

create index idx_scan_runs_started on scan_runs(started_at desc);
create index idx_scan_runs_status on scan_runs(status);

create table agent_events (
  id         uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id) on delete cascade,
  event_type text not null,                       -- 'new_high_score_match' | 'new_value_chain_partner' | 'new_cluster_member'
  payload    jsonb not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_agent_events_company on agent_events(company_id, created_at desc);
create index idx_agent_events_unread on agent_events(company_id) where read = false;
