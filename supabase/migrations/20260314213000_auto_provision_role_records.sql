insert into public.students (user_id)
select profiles.id
from public.profiles
where profiles.role = 'student'
  and not exists (
    select 1
    from public.students
    where students.user_id = profiles.id
  );

insert into public.teachers (user_id)
select profiles.id
from public.profiles
where profiles.role = 'teacher'
  and not exists (
    select 1
    from public.teachers
    where teachers.user_id = profiles.id
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  if assigned_role not in ('student', 'teacher', 'admin', 'parent') then
    assigned_role := 'student';
  end if;

  insert into public.profiles (id, role)
  values (new.id, assigned_role)
  on conflict (id) do update
  set role = excluded.role;

  if assigned_role = 'student' then
    insert into public.students (user_id)
    select new.id
    where not exists (
      select 1
      from public.students
      where user_id = new.id
    );
  elsif assigned_role = 'teacher' then
    insert into public.teachers (user_id)
    select new.id
    where not exists (
      select 1
      from public.teachers
      where user_id = new.id
    );
  end if;

  return new;
end;
$$;