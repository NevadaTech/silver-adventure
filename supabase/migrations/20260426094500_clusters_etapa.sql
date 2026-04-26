-- =====================================================================
-- Add etapa column to clusters
--
-- Used by the new `heuristic-etapa` and `heuristic-hibrido` cluster types
-- introduced to satisfy the reto's requirement for clusters by stage of
-- growth. Nullable because predefined and pure CIIU clusters do not
-- carry an etapa.
-- =====================================================================

alter table clusters
  add column if not exists etapa text;

create index if not exists idx_clusters_etapa on clusters(etapa);
