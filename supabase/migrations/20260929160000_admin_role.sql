-- roles live in auth app_metadata (server-side only): 'staff' = read-only, 'admin' = full access

drop policy "Staff read customers" on public.customers;
drop policy "Staff read preferred_bets" on public.preferred_bets;
drop policy "Staff read bet_volumes" on public.bet_volumes;

-- read: staff and admin
create policy "Staff and admin read customers" on public.customers
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));
create policy "Staff and admin read preferred_bets" on public.preferred_bets
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));
create policy "Staff and admin read bet_volumes" on public.bet_volumes
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('staff', 'admin'));

-- write: admin only
create policy "Admin insert customers" on public.customers
  for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin update customers" on public.customers
  for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin delete customers" on public.customers
  for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin insert preferred_bets" on public.preferred_bets
  for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin update preferred_bets" on public.preferred_bets
  for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin delete preferred_bets" on public.preferred_bets
  for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin insert bet_volumes" on public.bet_volumes
  for insert to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin update bet_volumes" on public.bet_volumes
  for update to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admin delete bet_volumes" on public.bet_volumes
  for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- admin-only user management (auth.users is not exposed through the API)
create function public.admin_list_users()
returns table (id uuid, email text, role text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
    select u.id, u.email::text, u.raw_app_meta_data ->> 'role', u.created_at, u.last_sign_in_at
    from auth.users u
    order by u.created_at;
end;
$$;

-- new_role: 'staff', 'admin', or null to remove the role
create function public.admin_set_user_role(target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if new_role is not null and new_role not in ('staff', 'admin') then
    raise exception 'invalid role: %', new_role using errcode = '22023';
  end if;
  if target_user = auth.uid() then
    raise exception 'admins cannot change their own role' using errcode = '42501';
  end if;

  update auth.users
     set raw_app_meta_data = case
           when new_role is null then coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
           else coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
         end
   where id = target_user;

  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
