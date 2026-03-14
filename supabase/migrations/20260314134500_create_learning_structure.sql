create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  grade_level text,
  created_at timestamptz not null default now()
);

create index if not exists students_user_id_idx on public.students (user_id);
create index if not exists students_institution_id_idx on public.students (institution_id);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  specialization text,
  created_at timestamptz not null default now()
);

create index if not exists teachers_user_id_idx on public.teachers (user_id);
create index if not exists teachers_institution_id_idx on public.teachers (institution_id);

create table if not exists public.curricula (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);

create table if not exists public.competencies (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills (id) on delete cascade,
  description text
);

create index if not exists competencies_skill_id_idx on public.competencies (skill_id);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  curriculum_id uuid references public.curricula (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists courses_teacher_id_idx on public.courses (teacher_id);
create index if not exists courses_curriculum_id_idx on public.courses (curriculum_id);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  content text,
  difficulty_level text,
  created_at timestamptz not null default now()
);

create index if not exists lessons_course_id_idx on public.lessons (course_id);

create table if not exists public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  objective text not null,
  competency_id uuid references public.competencies (id) on delete set null
);

create index if not exists learning_objectives_lesson_id_idx on public.learning_objectives (lesson_id);

alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.curricula enable row level security;
alter table public.skills enable row level security;
alter table public.competencies enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.learning_objectives enable row level security;
