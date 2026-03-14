create table if not exists public.standards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text
);

create unique index if not exists standards_code_idx on public.standards (code);

alter table public.standards enable row level security;

alter table public.learning_objectives
  add column if not exists standard_id uuid references public.standards (id) on delete set null;

create index if not exists learning_objectives_standard_id_idx on public.learning_objectives (standard_id);

alter table public.questions
  add column if not exists learning_objective_id uuid references public.learning_objectives (id) on delete set null;

create index if not exists questions_learning_objective_id_idx on public.questions (learning_objective_id);

alter table public.content_items
  add column if not exists learning_objective_id uuid references public.learning_objectives (id) on delete set null;

create index if not exists content_items_learning_objective_id_idx on public.content_items (learning_objective_id);



drop policy if exists "standards_read_authenticated" on public.standards;
create policy "standards_read_authenticated"
on public.standards
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "standards_write_admin" on public.standards;
create policy "standards_write_admin"
on public.standards
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

