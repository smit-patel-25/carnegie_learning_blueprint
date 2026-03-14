drop policy if exists "learning_paths_write_student_scope" on public.learning_paths;
drop policy if exists "learning_paths_update_student_scope" on public.learning_paths;

drop policy if exists "learning_paths_write_student_teacher_or_admin" on public.learning_paths;
create policy "learning_paths_write_student_teacher_or_admin"
on public.learning_paths
for insert
to authenticated
with check (
  student_id = public.current_student_id()
  or public.is_admin()
  or exists (
    select 1
    from public.courses
    where courses.id = learning_paths.course_id
      and courses.teacher_id = public.current_teacher_id()
  )
);

drop policy if exists "learning_paths_update_student_teacher_or_admin" on public.learning_paths;
create policy "learning_paths_update_student_teacher_or_admin"
on public.learning_paths
for update
to authenticated
using (
  student_id = public.current_student_id()
  or public.is_admin()
  or exists (
    select 1
    from public.courses
    where courses.id = learning_paths.course_id
      and courses.teacher_id = public.current_teacher_id()
  )
)
with check (
  student_id = public.current_student_id()
  or public.is_admin()
  or exists (
    select 1
    from public.courses
    where courses.id = learning_paths.course_id
      and courses.teacher_id = public.current_teacher_id()
  )
);
