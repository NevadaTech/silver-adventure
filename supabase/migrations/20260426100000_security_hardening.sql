-- =====================================================================
-- Security hardening
--
-- 1) Pin a stable search_path on `set_updated_at` (advisor warn).
-- 2) Allow authenticated users to READ reference tables that are not
--    sensitive (ciiu_taxonomy, clusters, cluster_members, cluster_ciiu_mapping).
--    These are essentially public lookup data — the brain populates them
--    via service-role and the front does not need to write to them.
--
-- TABLES INTENTIONALLY LEFT WITHOUT POLICIES
--   - recommendations, agent_events, ai_match_cache, scan_runs, otp_sessions
--
-- They are accessed exclusively by the NestJS brain via the service role
-- (which bypasses RLS). Leaving them with RLS-enabled-no-policy ensures
-- that a leaked publishable key cannot read them. This is the documented
-- "Plan B" trade-off chosen for the hackathon — recommendations have no
-- direct user_id column, so a per-user policy would require joining via
-- the company table on every read and the BFF already enforces ownership.
-- =====================================================================

create or replace function set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "ciiu_taxonomy_read_authenticated" on ciiu_taxonomy;
create policy "ciiu_taxonomy_read_authenticated"
  on ciiu_taxonomy
  for select
  to authenticated
  using (true);

drop policy if exists "clusters_read_authenticated" on clusters;
create policy "clusters_read_authenticated"
  on clusters
  for select
  to authenticated
  using (true);

drop policy if exists "cluster_members_read_authenticated" on cluster_members;
create policy "cluster_members_read_authenticated"
  on cluster_members
  for select
  to authenticated
  using (true);

drop policy if exists "cluster_ciiu_mapping_read_authenticated" on cluster_ciiu_mapping;
create policy "cluster_ciiu_mapping_read_authenticated"
  on cluster_ciiu_mapping
  for select
  to authenticated
  using (true);
