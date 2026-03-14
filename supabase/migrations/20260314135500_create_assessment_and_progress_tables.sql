create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  type text not null check (type in ('quiz', 'assignment', 'exam')),
  created_at timestamptz not null default now()
);

create index if not exists assessments_lesson_id_idx on public.assessments (lesson_id);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  question_text text not null,
  difficulty text,
  correct_answer text,
  explanation text
);

create index if not exists questions_assessment_id_idx on public.questions (assessment_id);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  score numeric,
  submitted_at timestamptz not null default now(),
  constraint submissions_student_assessment_key unique (student_id, assessment_id)
);

create index if not exists submissions_student_id_idx on public.submissions (student_id);
create index if not exists submissions_assessment_id_idx on public.submissions (assessment_id);

create table if not exists public.progress_tracking (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completion_percentage numeric,
  mastery_score numeric,
  last_accessed timestamptz,
  constraint progress_tracking_student_lesson_key unique (student_id, lesson_id)
);

create index if not exists progress_tracking_student_id_idx on public.progress_tracking (student_id);
create index if not exists progress_tracking_lesson_id_idx on public.progress_tracking (lesson_id);

create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  current_lesson_id uuid references public.lessons (id) on delete set null
);

create index if not exists learning_paths_student_id_idx on public.learning_paths (student_id);
create index if not exists learning_paths_course_id_idx on public.learning_paths (course_id);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  type text not null check (type in ('video', 'audio', 'text', 'interactive')),
  url text,
  metadata jsonb
);

create index if not exists content_items_lesson_id_idx on public.content_items (lesson_id);

alter table public.assessments enable row level security;
alter table public.questions enable row level security;
alter table public.submissions enable row level security;
alter table public.progress_tracking enable row level security;
alter table public.learning_paths enable row level security;
alter table public.content_items enable row level security;
