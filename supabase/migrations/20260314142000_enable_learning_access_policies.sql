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
  limit 1;
$$;

grant execute on function public.current_student_id() to authenticated;
grant execute on function public.current_teacher_id() to authenticated;

drop policy if exists "students_select_own_teacher_or_admin" on public.students;
create policy "students_select_own_teacher_or_admin"
on public.students
for select
to authenticated
using (
  id = public.current_student_id()
  or public.is_admin()
  or exists (
    select 1
    from public.teachers
    where id = public.current_teacher_id()
      and institution_id = students.institution_id
  )
);

drop policy if exists "students_update_own" on public.students;
create policy "students_update_own"
on public.students
for update
to authenticated
using (id = public.current_student_id())
with check (id = public.current_student_id());

drop policy if exists "teachers_select_own_peer_or_admin" on public.teachers;
create policy "teachers_select_own_peer_or_admin"
on public.teachers
for select
to authenticated
using (
  id = public.current_teacher_id()
  or public.is_admin()
  or exists (
    select 1
    from public.teachers current_teacher
    where current_teacher.id = public.current_teacher_id()
      and current_teacher.institution_id = teachers.institution_id
  )
);

drop policy if exists "teachers_update_own" on public.teachers;
create policy "teachers_update_own"
on public.teachers
for update
to authenticated
using (id = public.current_teacher_id())
with check (id = public.current_teacher_id());

drop policy if exists "curricula_read_authenticated" on public.curricula;
create policy "curricula_read_authenticated"
on public.curricula
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "curricula_write_admin" on public.curricula;
create policy "curricula_write_admin"
on public.curricula
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "skills_read_authenticated" on public.skills;
create policy "skills_read_authenticated"
on public.skills
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "skills_write_admin" on public.skills;
create policy "skills_write_admin"
on public.skills
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "competencies_read_authenticated" on public.competencies;
create policy "competencies_read_authenticated"
on public.competencies
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "competencies_write_admin" on public.competencies;
create policy "competencies_write_admin"
on public.competencies
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

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
    from public.learning_paths
    where learning_paths.course_id = courses.id
      and learning_paths.student_id = public.current_student_id()
  )
);

drop policy if exists "courses_insert_teacher_or_admin" on public.courses;
create policy "courses_insert_teacher_or_admin"
on public.courses
for insert
to authenticated
with check (
  public.is_admin()
  or teacher_id = public.current_teacher_id()
);

drop policy if exists "courses_update_teacher_or_admin" on public.courses;
create policy "courses_update_teacher_or_admin"
on public.courses
for update
to authenticated
using (
  public.is_admin()
  or teacher_id = public.current_teacher_id()
)
with check (
  public.is_admin()
  or teacher_id = public.current_teacher_id()
);

drop policy if exists "lessons_select_viewer_scope" on public.lessons;
create policy "lessons_select_viewer_scope"
on public.lessons
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.courses
    where courses.id = lessons.course_id
      and (
        courses.teacher_id = public.current_teacher_id()
        or exists (
          select 1
          from public.learning_paths
          where learning_paths.course_id = courses.id
            and learning_paths.student_id = public.current_student_id()
        )
      )
  )
);

drop policy if exists "lessons_write_teacher_or_admin" on public.lessons;
create policy "lessons_write_teacher_or_admin"
on public.lessons
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.courses
    where courses.id = lessons.course_id
      and courses.teacher_id = public.current_teacher_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.courses
    where courses.id = lessons.course_id
      and courses.teacher_id = public.current_teacher_id()
  )
);

drop policy if exists "learning_objectives_select_viewer_scope" on public.learning_objectives;
create policy "learning_objectives_select_viewer_scope"
on public.learning_objectives
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = learning_objectives.lesson_id
      and (
        courses.teacher_id = public.current_teacher_id()
        or exists (
          select 1
          from public.learning_paths
          where learning_paths.course_id = courses.id
            and learning_paths.student_id = public.current_student_id()
        )
      )
  )
);

drop policy if exists "learning_objectives_write_teacher_or_admin" on public.learning_objectives;
create policy "learning_objectives_write_teacher_or_admin"
on public.learning_objectives
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = learning_objectives.lesson_id
      and courses.teacher_id = public.current_teacher_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = learning_objectives.lesson_id
      and courses.teacher_id = public.current_teacher_id()
  )
);

drop policy if exists "assessments_select_viewer_scope" on public.assessments;
create policy "assessments_select_viewer_scope"
on public.assessments
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = assessments.lesson_id
      and (
        courses.teacher_id = public.current_teacher_id()
        or exists (
          select 1
          from public.learning_paths
          where learning_paths.course_id = courses.id
            and learning_paths.student_id = public.current_student_id()
        )
      )
  )
);

drop policy if exists "assessments_write_teacher_or_admin" on public.assessments;
create policy "assessments_write_teacher_or_admin"
on public.assessments
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = assessments.lesson_id
      and courses.teacher_id = public.current_teacher_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = assessments.lesson_id
      and courses.teacher_id = public.current_teacher_id()
  )
);

drop policy if exists "questions_select_viewer_scope" on public.questions;
create policy "questions_select_viewer_scope"
on public.questions
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.assessments
    join public.lessons on lessons.id = assessments.lesson_id
    join public.courses on courses.id = lessons.course_id
    where assessments.id = questions.assessment_id
      and (
        courses.teacher_id = public.current_teacher_id()
        or exists (
          select 1
          from public.learning_paths
          where learning_paths.course_id = courses.id
            and learning_paths.student_id = public.current_student_id()
        )
      )
  )
);

drop policy if exists "questions_write_teacher_or_admin" on public.questions;
create policy "questions_write_teacher_or_admin"
on public.questions
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.assessments
    join public.lessons on lessons.id = assessments.lesson_id
    join public.courses on courses.id = lessons.course_id
    where assessments.id = questions.assessment_id
      and courses.teacher_id = public.current_teacher_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.assessments
    join public.lessons on lessons.id = assessments.lesson_id
    join public.courses on courses.id = lessons.course_id
    where assessments.id = questions.assessment_id
      and courses.teacher_id = public.current_teacher_id()
  )
);

drop policy if exists "submissions_select_viewer_scope" on public.submissions;
create policy "submissions_select_viewer_scope"
on public.submissions
for select
to authenticated
using (
  public.is_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.assessments
    join public.lessons on lessons.id = assessments.lesson_id
    join public.courses on courses.id = lessons.course_id
    where assessments.id = submissions.assessment_id
      and courses.teacher_id = public.current_teacher_id()
  )
);

drop policy if exists "submissions_write_student_scope" on public.submissions;
create policy "submissions_write_student_scope"
on public.submissions
for insert
to authenticated
with check (student_id = public.current_student_id());

drop policy if exists "submissions_update_student_scope" on public.submissions;
create policy "submissions_update_student_scope"
on public.submissions
for update
to authenticated
using (student_id = public.current_student_id())
with check (student_id = public.current_student_id());

drop policy if exists "progress_select_viewer_scope" on public.progress_tracking;
create policy "progress_select_viewer_scope"
on public.progress_tracking
for select
to authenticated
using (
  public.is_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = progress_tracking.lesson_id
      and courses.teacher_id = public.current_teacher_id()
  )
);

drop policy if exists "progress_write_student_scope" on public.progress_tracking;
create policy "progress_write_student_scope"
on public.progress_tracking
for insert
to authenticated
with check (student_id = public.current_student_id());

drop policy if exists "progress_update_student_scope" on public.progress_tracking;
create policy "progress_update_student_scope"
on public.progress_tracking
for update
to authenticated
using (student_id = public.current_student_id())
with check (student_id = public.current_student_id());

drop policy if exists "learning_paths_select_viewer_scope" on public.learning_paths;
create policy "learning_paths_select_viewer_scope"
on public.learning_paths
for select
to authenticated
using (
  public.is_admin()
  or student_id = public.current_student_id()
  or exists (
    select 1
    from public.courses
    where courses.id = learning_paths.course_id
      and courses.teacher_id = public.current_teacher_id()
  )
);

drop policy if exists "learning_paths_write_student_scope" on public.learning_paths;
create policy "learning_paths_write_student_scope"
on public.learning_paths
for insert
to authenticated
with check (student_id = public.current_student_id());

drop policy if exists "learning_paths_update_student_scope" on public.learning_paths;
create policy "learning_paths_update_student_scope"
on public.learning_paths
for update
to authenticated
using (student_id = public.current_student_id())
with check (student_id = public.current_student_id());

drop policy if exists "content_items_select_viewer_scope" on public.content_items;
create policy "content_items_select_viewer_scope"
on public.content_items
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = content_items.lesson_id
      and (
        courses.teacher_id = public.current_teacher_id()
        or exists (
          select 1
          from public.learning_paths
          where learning_paths.course_id = courses.id
            and learning_paths.student_id = public.current_student_id()
        )
      )
  )
);

drop policy if exists "content_items_write_teacher_or_admin" on public.content_items;
create policy "content_items_write_teacher_or_admin"
on public.content_items
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = content_items.lesson_id
      and courses.teacher_id = public.current_teacher_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.lessons
    join public.courses on courses.id = lessons.course_id
    where lessons.id = content_items.lesson_id
      and courses.teacher_id = public.current_teacher_id()
  )
);
