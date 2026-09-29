-- replace public read access with read access for signed-in staff only.
-- app_metadata can only be set server-side (service role), so users cannot grant themselves the role.
drop policy "Public read customers" on public.customers;
drop policy "Public read preferred_bets" on public.preferred_bets;
drop policy "Public read bet_volumes" on public.bet_volumes;

create policy "Staff read customers" on public.customers
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

create policy "Staff read preferred_bets" on public.preferred_bets
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

create policy "Staff read bet_volumes" on public.bet_volumes
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');
