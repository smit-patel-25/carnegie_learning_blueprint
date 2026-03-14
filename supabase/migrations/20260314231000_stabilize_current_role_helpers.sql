create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.students
  where user_id = (select auth.uid())
  order by created_at asc, id asc
  limit 1;
$$;

create or replace function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.teachers
  where user_id = (select auth.uid())
  order by created_at asc, id asc
  limit 1;
$$;
