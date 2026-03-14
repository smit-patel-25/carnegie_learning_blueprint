alter table public.profiles enable row level security;
alter table public.institutions enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.is_admin()
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "institutions_read_authenticated" on public.institutions;
create policy "institutions_read_authenticated"
on public.institutions
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "institutions_insert_admin" on public.institutions;
create policy "institutions_insert_admin"
on public.institutions
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "institutions_update_admin" on public.institutions;
create policy "institutions_update_admin"
on public.institutions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "institutions_delete_admin" on public.institutions;
create policy "institutions_delete_admin"
on public.institutions
for delete
to authenticated
using (public.is_admin());
