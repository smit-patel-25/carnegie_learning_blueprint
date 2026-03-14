import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { AssessmentPanel } from "@/app/(dashboard)/dashboard/courses/[courseId]/lessons/[lessonId]/_components/assessment-panel";
import { CourseProgressForm } from "@/app/(dashboard)/dashboard/_components/course-progress-form";
import { getLessonAssessmentExperienceForViewer } from "@/lib/assessments/service";
import { getCourseDetailsForViewer } from "@/lib/learning/service";
import { getLessonPathwayForViewer } from "@/lib/learning/pathway";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lesson View | Adaptive Learning Intelligence Platform",
  description: "Open a lesson, review progress, complete assessments, and keep learning momentum moving.",
};

type LessonPageProps = {
  params: Promise<{
    courseId: string;
    lessonId: string;
  }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();
  const [courseResult, assessmentResult, pathwayResult] = await Promise.all([
    getCourseDetailsForViewer(supabase, { courseId }),
    getLessonAssessmentExperienceForViewer(supabase, { courseId, lessonId }),
    getLessonPathwayForViewer(supabase, { courseId, lessonId }),
  ]);

  if (courseResult.error || !courseResult.data) {
    notFound();
  }

  const courseDetail = courseResult.data;
  const lessons = courseDetail.lessons;
  const activeLessonIndex = lessons.findIndex((lesson) => lesson.id === lessonId);

  if (activeLessonIndex === -1) {
    notFound();
  }

  const activeLesson = lessons[activeLessonIndex];
  const nextLesson = lessons[activeLessonIndex + 1] ?? null;
  const previousLesson = lessons[activeLessonIndex - 1] ?? null;
  const courseCompletion =
    lessons.length === 0
      ? 0
      : Math.round(
          lessons.reduce((sum, lesson) => sum + lesson.completionPercentage, 0) / lessons.length,
        );

  const lastAccessedLabel = activeLesson.lastAccessed
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(activeLesson.lastAccessed))
    : "No recent activity";
  const assessment = assessmentResult.data?.activeAssessment ?? null;
  const assessmentError = assessmentResult.error;
  const pathway = pathwayResult.data ?? null;
  const pathwayError = pathwayResult.error;
  const showStudentAssessment = courseDetail.viewerRole === "student" && assessment;
  const showTeacherPreview =
    (courseDetail.viewerRole === "teacher" || courseDetail.viewerRole === "admin") && assessment;

  return (
    <main className="container py-8 md:py-12">
      <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard" className="transition hover:text-slate-950">
            Dashboard
          </Link>
          <span>/</span>
          <Link
            href={`/dashboard?course=${courseDetail.course.id}`}
            className="transition hover:text-slate-950"
          >
            {courseDetail.course.title}
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-900">{activeLesson.title}</span>
        </nav>

        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-sky-700">
                Lesson view
              </p>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                  {activeLesson.title}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                  Stay focused on one concept at a time. Review the lesson, confirm understanding,
                  and update progress before moving forward.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-2">{activeLesson.difficultyLevel}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
                  {activeLesson.completionPercentage}% complete
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">
                  {activeLesson.masteryScore}% mastery
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[380px]">
              <StatCard label="Course progress" value={`${courseCompletion}%`} tone="sky" />
              <StatCard
                label="Lesson progress"
                value={`${activeLesson.completionPercentage}%`}
                tone="emerald"
              />
              <StatCard label="Last activity" value={lastAccessedLabel} tone="slate" />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-6">
            <article className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">
                    Lesson content
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    Work through the concept clearly.
                  </h2>
                </div>
                <Link
                  href={`/dashboard?course=${courseDetail.course.id}`}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                >
                  Back to overview
                </Link>
              </div>
              <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-5 text-sm leading-8 text-slate-700 md:p-6 md:text-base">
                {activeLesson.content}
              </div>
            </article>

            <section className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">
                    Your checkpoint
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    Capture progress before the next step.
                  </h2>
                </div>
                {nextLesson ? (
                  <Link
                    href={`/dashboard/courses/${courseDetail.course.id}/lessons/${nextLesson.id}`}
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Next lesson
                  </Link>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InsightCard
                  title="Completion"
                  value={`${activeLesson.completionPercentage}%`}
                  description="Keep this moving upward as you finish examples, practice, and review."
                />
                <InsightCard
                  title="Mastery"
                  value={`${activeLesson.masteryScore}%`}
                  description="Use this as your confidence signal before you advance to the next concept."
                />
              </div>

              {courseDetail.canRecordProgress ? (
                <div className="mt-6">
                  <CourseProgressForm
                    courseId={courseDetail.course.id}
                    lessonId={activeLesson.id}
                    completionPercentage={activeLesson.completionPercentage}
                    masteryScore={activeLesson.masteryScore}
                  />
                </div>
              ) : (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                  Progress updates are currently available in student mode.
                </div>
              )}
            </section>

            {pathwayError ? (
              <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm md:p-8">
                <p className="font-mono text-xs uppercase tracking-[0.28em]">Learning path</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  We could not load the lesson alignment details.
                </h2>
                <p className="mt-3 text-sm leading-7">{pathwayError}</p>
              </section>
            ) : pathway ? (
              <section className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">
                      Learning path
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                      See how this lesson fits the path and objective map.
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-slate-600">
                      This lesson is step {pathway.activePosition} of {pathway.totalLessons}, with {pathway.assessmentCount} checkpoint{pathway.assessmentCount === 1 ? "" : "s"} attached.
                    </p>
                  </div>
                  <span className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${pathwayTone(pathway.progressState)}`}>
                    {pathwayLabel(pathway.progressState)}
                  </span>
                </div>

                {pathway.objectives.length === 0 ? (
                  <div className="mt-6 rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                    Learning objectives have not been tagged for this lesson yet.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {pathway.objectives.map((objective) => (
                      <article key={objective.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-wrap gap-2">
                          {objective.standardCode ? (
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                              {objective.standardCode}
                            </span>
                          ) : null}
                          {objective.competency ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                              {objective.competency}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-950">{objective.objective}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {objective.standardDescription ?? "This objective can be used to align lesson resources and checkpoints."}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {assessmentError ? (
              <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm md:p-8">
                <p className="font-mono text-xs uppercase tracking-[0.28em]">Assessment checkpoint</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  We could not load the assessment for this lesson.
                </h2>
                <p className="mt-3 text-sm leading-7">{assessmentError}</p>
              </section>
            ) : showStudentAssessment && assessment ? (
              <AssessmentPanel
                courseId={courseDetail.course.id}
                lessonId={activeLesson.id}
                assessment={assessment}
              />
            ) : showTeacherPreview && assessment ? (
              <section className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">
                      Assessment preview
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                      This lesson already has a learner checkpoint.
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-slate-600">
                      Students can open this lesson and complete the latest checkpoint with built-in hints.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-2">{assessment.type}</span>
                    <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">
                      {assessment.questionCount} questions
                    </span>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[2rem] border border-dashed border-slate-200 bg-white/70 p-6 text-sm leading-7 text-slate-600 shadow-sm md:p-8">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">
                  Assessment checkpoint
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  No checkpoint is attached to this lesson yet.
                </h2>
                <p className="mt-3">
                  {courseDetail.viewerRole === "student"
                    ? "Your teacher has not attached an assessment to this lesson yet. Keep working through the lesson and track progress here in the meantime."
                    : "Generate a quiz, assignment, or exam draft from the course dashboard to attach a checkpoint to this lesson."}
                </p>
              </section>
            )}
          </section>

          <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
            <section className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)]">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">
                Lesson path
              </p>
              <div className="mt-4 space-y-3">
                {lessons.map((lesson, index) => {
                  const isActive = lesson.id === activeLesson.id;

                  return (
                    <Link
                      key={lesson.id}
                      href={`/dashboard/courses/${courseDetail.course.id}/lessons/${lesson.id}`}
                      className={`block rounded-[1.4rem] border p-4 transition ${
                        isActive
                          ? "border-sky-200 bg-sky-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0 space-y-2">
                          <p className="truncate text-sm font-semibold text-slate-950">{lesson.title}</p>
                          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                            <span>{lesson.difficultyLevel}</span>
                            <span>{lesson.completionPercentage}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-sky-500 transition-all"
                              style={{ width: `${lesson.completionPercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/80 bg-slate-950 p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-300">
                Navigation
              </p>
              <div className="mt-4 grid gap-3">
                {previousLesson ? (
                  <Link
                    href={`/dashboard/courses/${courseDetail.course.id}/lessons/${previousLesson.id}`}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
                  >
                    Previous lesson
                  </Link>
                ) : null}
                {nextLesson ? (
                  <Link
                    href={`/dashboard/courses/${courseDetail.course.id}/lessons/${nextLesson.id}`}
                    className="inline-flex items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    Continue forward
                  </Link>
                ) : (
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200">
                    You are on the latest lesson in this course. Review mastery, then return to the
                    dashboard for your broader progress view.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "slate";
};

function StatCard({ label, value, tone }: StatCardProps) {
  const toneClassName =
    tone === "sky"
      ? "bg-sky-50 text-sky-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-slate-100 text-slate-700";

  return (
    <div className={`rounded-[1.5rem] p-4 ${toneClassName}`}>
      <p className="text-xs font-medium uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-3 text-lg font-semibold leading-6">{value}</p>
    </div>
  );
}

type InsightCardProps = {
  title: string;
  value: string;
  description: string;
};

function InsightCard({ title, value, description }: InsightCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function pathwayLabel(state: "not-started" | "current-focus" | "ready-to-advance") {
  if (state === "ready-to-advance") {
    return "Ready to advance";
  }

  if (state === "current-focus") {
    return "Current focus";
  }

  return "Not started";
}

function pathwayTone(state: "not-started" | "current-focus" | "ready-to-advance") {
  if (state === "ready-to-advance") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (state === "current-focus") {
    return "bg-sky-50 text-sky-700";
  }

  return "bg-slate-100 text-slate-700";
}
