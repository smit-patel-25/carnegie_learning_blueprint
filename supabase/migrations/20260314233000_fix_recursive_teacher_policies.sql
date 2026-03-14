create or replace function public.current_teacher_institution_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institution_id
  from public.teachers
  where user_id = (select auth.uid())
  order by created_at asc, id asc
  limit 1;
$$;

grant execute on function public.current_teacher_institution_id() to authenticated;

drop policy if exists "teachers_select_own_peer_or_admin" on public.teachers;
create policy "teachers_select_own_or_admin"
on public.teachers
for select
to authenticated
using (
  id = public.current_teacher_id()
  or public.is_admin()
);

drop policy if exists "students_select_own_teacher_or_admin" on public.students;
create policy "students_select_own_teacher_or_admin"
on public.students
for select
to authenticated
using (
  id = public.current_student_id()
  or public.is_admin()
  or (
    public.current_teacher_institution_id() is not null
    and institution_id = public.current_teacher_institution_id()
  )
);
