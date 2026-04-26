-- =====================================================================
-- Connections — user actions on recommendations
--
-- A `connection` represents a user explicitly acting on a recommendation:
--   - 'marked'            → "I'm going to contact this company"
--   - 'saved'             → "Bookmark for later"
--   - 'dismissed'         → "Not interested"
--   - 'simulated_contact' → "I clicked the WhatsApp button"
--
-- The same user can have multiple distinct actions on the same rec
-- (e.g. saved + simulated_contact), so the unique key is the triple
-- (user_id, recommendation_id, action). Re-recording the same action
-- is an idempotent upsert.
-- =====================================================================

create table connections (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  recommendation_id  uuid not null references recommendations(id) on delete cascade,
  action             text not null check (action in ('marked','saved','dismissed','simulated_contact')),
  note               text check (note is null or char_length(note) <= 280),
  created_at         timestamptz not null default now(),
  unique (user_id, recommendation_id, action)
);

create index idx_connections_user on connections(user_id, created_at desc);
create index idx_connections_rec on connections(recommendation_id);

alter table connections enable row level security;

drop policy if exists "connections_owner_all" on connections;
create policy "connections_owner_all"
  on connections
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
