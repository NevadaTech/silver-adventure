-- =====================================================================
-- Link users → companies (1:1 ownership)
-- A user (account) owns at most one company. Nullable so legacy users
-- created before classification keep working.
-- =====================================================================

alter table users
  add column if not exists company_id text
    references companies(id) on delete set null;

create index if not exists idx_users_company_id on users(company_id);
