import type { Metadata } from "next";

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Parent Portal | Adaptive Learning Intelligence Platform",
  description: "Monitor linked learner status from a dedicated parent workspace.",
};

type ParentAccountRow = {
  student_id: string;
  relationship: string | null;
};

type StudentRow = {
  id: string;
  grade_level: string | null;
};

type LearningPathRow = {
  student_id: string;
  course_id: string;
  current_lesson_id: string | null;
};

type CourseRow = {
  id: string;
  title: string;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
};

type ProgressRow = {
  student_id: string;
  lesson_id: string;
  completion_percentage: number;
  mastery_score: number;
  last_accessed: string | null;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export default async function ParentPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileResponse = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profileResponse.data?.role ?? "student";

  if (role !== "parent") {
    redirect("/dashboard");
  }

  const parentAccountsResponse = await supabase
    .from("parent_accounts")
    .select("student_id, relationship")
    .eq("user_id", user.id);

  const parentAccounts =
    parentAccountsResponse.error || !parentAccountsResponse.data
      ? []
      : (parentAccountsResponse.data as ParentAccountRow[]);

  const studentIds = [...new Set(parentAccounts.map((account) => account.student_id))];

  let students: StudentRow[] = [];
  let learningPaths: LearningPathRow[] = [];
  let courses: CourseRow[] = [];
  let lessons: LessonRow[] = [];
  let progressRows: ProgressRow[] = [];

  if (studentIds.length > 0) {
    const studentsResponse = await supabase
      .from("students")
      .select("id, grade_level")
      .in("id", studentIds);
    students = (studentsResponse.data ?? []) as StudentRow[];

    const learningPathsResponse = await supabase
      .from("learning_paths")
      .select("student_id, course_id, current_lesson_id")
      .in("student_id", studentIds);
    learningPaths = (learningPathsResponse.data ?? []) as LearningPathRow[];

    const courseIds = [...new Set(learningPaths.map((path) => path.course_id))];

    if (courseIds.length > 0) {
      const coursesResponse = await supabase
        .from("courses")
        .select("id, title")
        .in("id", courseIds);
      courses = (coursesResponse.data ?? []) as CourseRow[];

      const lessonsResponse = await supabase
        .from("lessons")
        .select("id, course_id, title")
        .in("course_id", courseIds);
      lessons = (lessonsResponse.data ?? []) as LessonRow[];
    }

    const lessonIds = lessons.map((lesson) => lesson.id);

    if (lessonIds.length > 0) {
      const progressResponse = await supabase
        .from("progress_tracking")
        .select("student_id, lesson_id, completion_percentage, mastery_score, last_accessed")
        .in("student_id", studentIds)
        .in("lesson_id", lessonIds);
      progressRows = (progressResponse.data ?? []) as ProgressRow[];
    }
  }

  const studentById = new Map(students.map((student) => [student.id, student]));
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const summaries = studentIds.map((studentId, index) => {
    const linked = parentAccounts.find((account) => account.student_id === studentId);
    const student = studentById.get(studentId);
    const studentPaths = learningPaths.filter((path) => path.student_id === studentId);
    const studentCourseTitles = studentPaths
      .map((path) => courseById.get(path.course_id)?.title)
      .filter((value): value is string => Boolean(value));

    const studentLessonIds = lessons
      .filter((lesson) => studentPaths.some((path) => path.course_id === lesson.course_id))
      .map((lesson) => lesson.id);

    const studentProgress = progressRows.filter((row) => {
      return row.student_id === studentId && studentLessonIds.includes(row.lesson_id);
    });

    const completion = average(studentProgress.map((row) => row.completion_percentage));
    const mastery = average(studentProgress.map((row) => row.mastery_score));
    const latestAccess =
      studentProgress
        .map((row) => row.last_accessed)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

    return {
      studentId,
      label: `Learner ${String(index + 1).padStart(2, "0")}`,
      relationship: linked?.relationship ?? "Guardian",
      gradeLevel: student?.grade_level ?? "Not set",
      enrolledCourses: studentCourseTitles,
      completion,
      mastery,
      latestAccess,
    };
  });

  return (
    <main className="container py-10 md:py-16">
      <section className="mx-auto max-w-6xl space-y-6 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur md:p-8">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">Parent portal</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Track your child&apos;s progress and activity.
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            Review enrolled courses, completion, mastery trends, and recent activity for each linked learner.
          </p>
        </div>

        {parentAccountsResponse.error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-800"
          >
            Parent account links are not available right now. Please try again shortly.
          </div>
        ) : summaries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/30 p-6">
            <h2 className="text-lg font-semibold text-foreground">No learners linked yet.</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Ask an administrator to connect your account to a learner profile.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {summaries.map((summary) => (
              <article key={summary.studentId} className="rounded-[1.4rem] border border-border bg-muted/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">{summary.label}</h2>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {summary.gradeLevel}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Relationship: <span className="font-medium text-foreground">{summary.relationship}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Courses: <span className="font-medium text-foreground">{summary.enrolledCourses.length}</span>
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.1rem] border border-border/70 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Completion</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{summary.completion}%</p>
                  </div>
                  <div className="rounded-[1.1rem] border border-border/70 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mastery</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{summary.mastery}%</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Latest activity: {summary.latestAccess ? new Date(summary.latestAccess).toLocaleString() : "No activity yet"}
                </p>
                {summary.enrolledCourses.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {summary.enrolledCourses.slice(0, 4).map((courseTitle) => (
                      <li key={`${summary.studentId}-${courseTitle}`}>- {courseTitle}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
