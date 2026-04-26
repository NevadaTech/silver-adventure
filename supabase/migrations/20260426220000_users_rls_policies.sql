-- =====================================================================
-- RLS policies for public.users
--
-- The signup flow uses the publishable key + the new user's JWT to insert
-- their own profile. RLS must allow each authenticated user to manage
-- ONLY their own row (auth.uid() must match users.id, which is the same
-- as auth.users.id by design).
-- =====================================================================

alter table public.users enable row level security;

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
  on public.users
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
