alter table public.profiles
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists bio text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "avatars_auth_insert_own" on storage.objects;
create policy "avatars_auth_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
);

drop policy if exists "avatars_auth_update_own" on storage.objects;
create policy "avatars_auth_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
);

drop policy if exists "avatars_auth_delete_own" on storage.objects;
create policy "avatars_auth_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = ((select auth.uid())::text)
);

create or replace function public.current_parent_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select student_id
  from public.parent_accounts
  where user_id = (select auth.uid());
$$;

create or replace function public.current_parent_course_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct course_id
  from public.learning_paths
  where student_id in (select public.current_parent_student_ids());
$$;

grant execute on function public.current_parent_student_ids() to authenticated;
grant execute on function public.current_parent_course_ids() to authenticated;

drop policy if exists "students_select_parent_linked" on public.students;
create policy "students_select_parent_linked"
on public.students
for select
to authenticated
using (
  id in (select public.current_parent_student_ids())
);

drop policy if exists "learning_paths_select_parent_linked" on public.learning_paths;
create policy "learning_paths_select_parent_linked"
on public.learning_paths
for select
to authenticated
using (
  student_id in (select public.current_parent_student_ids())
);

drop policy if exists "progress_select_parent_linked" on public.progress_tracking;
create policy "progress_select_parent_linked"
on public.progress_tracking
for select
to authenticated
using (
  student_id in (select public.current_parent_student_ids())
);

drop policy if exists "courses_select_parent_linked" on public.courses;
create policy "courses_select_parent_linked"
on public.courses
for select
to authenticated
using (
  id in (select public.current_parent_course_ids())
);

drop policy if exists "lessons_select_parent_linked" on public.lessons;
create policy "lessons_select_parent_linked"
on public.lessons
for select
to authenticated
using (
  course_id in (select public.current_parent_course_ids())
);

drop policy if exists "content_items_select_parent_linked" on public.content_items;
create policy "content_items_select_parent_linked"
on public.content_items
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons
    where lessons.id = content_items.lesson_id
      and lessons.course_id in (select public.current_parent_course_ids())
  )
);
