create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  title text not null,
  badge text,
  awarded_at timestamptz not null default now()
);

create index if not exists achievements_student_id_idx on public.achievements (student_id);

create table if not exists public.parent_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  relationship text
);

create index if not exists parent_accounts_user_id_idx on public.parent_accounts (user_id);
create index if not exists parent_accounts_student_id_idx on public.parent_accounts (student_id);

alter table public.achievements enable row level security;
alter table public.parent_accounts enable row level security;

drop policy if exists "achievements_select_own_or_admin" on public.achievements;
create policy "achievements_select_own_or_admin"
on public.achievements
for select
to authenticated
using (
  public.is_admin()
  or student_id = public.current_student_id()
);

drop policy if exists "achievements_write_admin" on public.achievements;
create policy "achievements_write_admin"
on public.achievements
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "parent_accounts_select_own_or_admin" on public.parent_accounts;
create policy "parent_accounts_select_own_or_admin"
on public.parent_accounts
for select
to authenticated
using (
  public.is_admin()
  or user_id = (select auth.uid())
);

drop policy if exists "parent_accounts_write_admin" on public.parent_accounts;
create policy "parent_accounts_write_admin"
on public.parent_accounts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
