-- read-only access for the frontend (synthetic demo data); no insert/update/delete policies
create policy "Public read customers" on public.customers
  for select to anon, authenticated using (true);

create policy "Public read preferred_bets" on public.preferred_bets
  for select to anon, authenticated using (true);

create policy "Public read bet_volumes" on public.bet_volumes
  for select to anon, authenticated using (true);
