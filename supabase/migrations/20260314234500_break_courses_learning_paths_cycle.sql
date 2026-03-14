create or replace function public.current_student_course_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select course_id
  from public.learning_paths
  where student_id = public.current_student_id();
$$;

grant execute on function public.current_student_course_ids() to authenticated;

drop policy if exists "courses_select_viewer_scope" on public.courses;
create policy "courses_select_viewer_scope"
on public.courses
for select
to authenticated
using (
  public.is_admin()
  or teacher_id = public.current_teacher_id()
  or exists (
    select 1
    from public.current_student_course_ids() as student_course_id
    where student_course_id = courses.id
  )
);
