import type { Metadata } from "next";

import Link from "next/link";

import { PendingLinkButton } from "@/components/dashboard/pending-link-button";
import { redirect } from "next/navigation";

import { AssignStudentForm } from "@/app/(dashboard)/dashboard/_components/assign-student-form";
import { CourseProgressForm } from "@/app/(dashboard)/dashboard/_components/course-progress-form";
import { GradebookExportControls } from "@/app/(dashboard)/dashboard/_components/gradebook-export-controls";
import { GenerateAssessmentForm } from "@/app/(dashboard)/dashboard/_components/generate-assessment-form";
import { TeacherAnalyticsRefresh } from "@/app/(dashboard)/dashboard/_components/teacher-analytics-refresh";
import { LinkParentForm } from "@/app/(dashboard)/dashboard/_components/link-parent-form";
import { getAdaptiveRecommendationsForViewer } from "@/lib/adaptive/engine";
import {
  getCourseDetailsForViewer,
  getTeacherCourseAnalyticsForViewer,
  listCoursesForViewer,
} from "@/lib/learning/service";
import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";
import { createClient } from "@/lib/supabase/server";
import type { AdaptiveRecommendation } from "@/lib/validations/adaptive";
import type { CourseDetail, TeacherCourseAnalytics } from "@/lib/validations/learning";

type AchievementItem = {
  id: string;
  title: string;
  badge: string | null;
  awarded_at: string | null;
};

type ManagedStudentOption = {
  id: string;
  label: string;
};

type ParentOption = {
  id: string;
  label: string;
};

export const metadata: Metadata = {
  title: "Dashboard | Adaptive Learning Intelligence Platform",
  description: "View courses, lessons, progress, and adaptive next steps from one focused workspace.",
};

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ViewerRole = "student" | "teacher" | "admin" | "parent";

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const selectedCourseId = typeof params.course === "string" ? params.course : "";
  const success = typeof params.success === "string" ? params.success : "";
  const error = typeof params.error === "string" ? params.error : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ensuredContext = await ensureViewerRoleRecordsForUser({
    userId: user.id,
    metadataRole: user.user_metadata?.role,
  });

  const viewerRole = (ensuredContext?.role ?? "student") as ViewerRole;
  const isTeacherView = viewerRole === "teacher" || viewerRole === "admin";
  const courseListResult = await listCoursesForViewer(supabase);

  if (courseListResult.error) {
    return (
      <main className="container py-16">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
          <h1 className="text-3xl font-semibold">We couldn&apos;t load your dashboard.</h1>
          <p className="mt-3 text-sm leading-7">{courseListResult.error}</p>
        </div>
      </main>
    );
  }

  const courses = courseListResult.data ?? [];
  const activeCourseId = selectedCourseId || courses[0]?.id || "";
  const courseDetailResult = activeCourseId
    ? await getCourseDetailsForViewer(supabase, { courseId: activeCourseId })
    : null;
  const teacherAnalyticsResult =
    isTeacherView && activeCourseId
      ? await getTeacherCourseAnalyticsForViewer(supabase, { courseId: activeCourseId })
      : null;
  const adaptiveRecommendationResult =
    viewerRole === "student" && activeCourseId
      ? await getAdaptiveRecommendationsForViewer(supabase, { courseId: activeCourseId })
      : null;

  const courseDetail =
    courseDetailResult && !courseDetailResult.error ? (courseDetailResult.data ?? null) : null;
  const teacherAnalytics =
    teacherAnalyticsResult && !teacherAnalyticsResult.error
      ? (teacherAnalyticsResult.data ?? null)
      : null;
  const adaptiveRecommendation =
    adaptiveRecommendationResult && !adaptiveRecommendationResult.error
      ? (adaptiveRecommendationResult.data?.[0] ?? null)
      : null;

  let achievements: AchievementItem[] = [];
  let achievementsError = "";

  if (viewerRole === "student") {
    const studentResponse = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (studentResponse.error) {
      achievementsError = "Achievements could not be loaded right now.";
    } else if (studentResponse.data?.[0]?.id) {
      const achievementsResponse = await supabase
        .from("achievements")
        .select("id, title, badge, awarded_at")
        .eq("student_id", studentResponse.data[0].id)
        .order("awarded_at", { ascending: false })
        .limit(6);

      if (achievementsResponse.error) {
        achievementsError = "Achievements could not be loaded right now.";
      } else {
        achievements = (achievementsResponse.data ?? []) as AchievementItem[];
      }
    }
  }

  let manageableStudents: ManagedStudentOption[] = [];
  let parentOptions: ParentOption[] = [];

  if (isTeacherView) {
    if (viewerRole === "teacher") {
      const teacherResponse = await supabase
        .from("teachers")
        .select("id, institution_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const institutionId = teacherResponse.data?.[0]?.institution_id ?? null;

      if (institutionId) {
        const studentsResponse = await supabase
          .from("students")
          .select("id, grade_level")
          .eq("institution_id", institutionId)
          .order("created_at", { ascending: true })
          .limit(100);

        manageableStudents = (studentsResponse.data ?? []).map((student, index) => ({
          id: student.id,
          label: `Learner ${String(index + 1).padStart(2, "0")} (${student.grade_level ?? "Grade not set"})`,
        }));
      }
    } else if (viewerRole === "admin") {
      const studentsResponse = await supabase
        .from("students")
        .select("id, grade_level")
        .order("created_at", { ascending: true })
        .limit(100);

      manageableStudents = (studentsResponse.data ?? []).map((student, index) => ({
        id: student.id,
        label: `Learner ${String(index + 1).padStart(2, "0")} (${student.grade_level ?? "Grade not set"})`,
      }));

      const parentsResponse = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "parent")
        .order("created_at", { ascending: true })
        .limit(100);

      parentOptions = (parentsResponse.data ?? []).map((parent, index) => ({
        id: parent.id,
        label: `Parent ${String(index + 1).padStart(2, "0")} (${parent.id.slice(0, 8)})`,
      }));
    }
  }
  const firstLessonLink =
    courseDetail && courseDetail.lessons.length > 0
      ? `/dashboard/courses/${courseDetail.course.id}/lessons/${courseDetail.lessons[0]?.id}`
      : null;

  const heroTitle =
    isTeacherView ? "See where your learners need you most." : "Keep momentum visible.";
  const heroDescription =
    isTeacherView
      ? "Track course health, review class progress, and spot learners who need support without leaving one protected workspace."
      : "Review what matters now, return to the next lesson quickly, and keep progress moving with adaptive guidance.";
  const courseSectionTitle = viewerRole === "teacher" ? "Courses you lead" : "Courses in focus";

  return (
    <main className="container py-10 md:py-16">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur">
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">
              Your workspace
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{heroTitle}</h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>. {heroDescription}
            </p>
          </div>

          {success ? (
            <p role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          ) : null}
          {error ? (
            <p role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{courseSectionTitle}</h2>
              <span className="text-sm text-muted-foreground">{courses.length} active</span>
            </div>
            {courses.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/40 p-6">
                <h3 className="text-lg font-semibold text-foreground">Nothing is assigned yet.</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Once courses are connected to your account, they will appear here with lesson
                  counts and progress snapshots.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {courses.map((course) => {
                  const isActive = course.id === activeCourseId;
                  const lessonHref = course.currentLessonId
                    ? `/dashboard/courses/${course.id}/lessons/${course.currentLessonId}`
                    : null;

                  return (
                    <div
                      key={course.id}
                      className={`rounded-[1.5rem] border p-5 transition ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/30 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Link href={`/dashboard?course=${course.id}`} className="space-y-2">
                          <h3 className="text-lg font-semibold text-foreground">{course.title}</h3>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {course.description}
                          </p>
                        </Link>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                          {course.lessonCount} lessons
                        </span>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          <span>{isTeacherView ? "Class progress" : "Progress"}</span>
                          <span>{course.completionPercentage}%</span>
                        </div>
                        <div role="progressbar" aria-label={`${course.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={course.completionPercentage} className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${course.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <PendingLinkButton
                          href={`/dashboard?course=${course.id}`}
                          label={isTeacherView ? "Open analytics" : "View course"}
                          pendingLabel="Loading course..."
                          className="inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                        />
                        {viewerRole === "student" && lessonHref ? (
                          <PendingLinkButton
                            href={lessonHref}
                            label="Continue lesson"
                            pendingLabel="Opening lesson..."
                            className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur">
          {courseDetailResult?.error ? (
            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-red-700">
              <h2 className="text-xl font-semibold">We couldn&apos;t load that course.</h2>
              <p className="mt-2 text-sm leading-6">{courseDetailResult.error}</p>
            </div>
          ) : !courseDetail ? (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/40 p-8">
              <h2 className="text-2xl font-semibold text-foreground">
                Choose a course to continue.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Lesson details, progress checkpoints, and the next action for each learner will
                appear here.
              </p>
            </div>
          ) : isTeacherView ? (
            <TeacherDashboardPanel
              courseId={courseDetail.course.id}
              courseTitle={courseDetail.course.title}
              courseDescription={courseDetail.course.description}
              firstLessonLink={firstLessonLink}
              analytics={teacherAnalytics}
              analyticsError={teacherAnalyticsResult?.error}
              students={manageableStudents}
              lessons={courseDetail.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title }))}
              parentOptions={parentOptions}
              canManageParentLinks={viewerRole === "admin"}
            />
          ) : (
            <StudentDashboardPanel
              courseDetail={courseDetail}
              firstLessonLink={firstLessonLink}
              adaptiveRecommendation={adaptiveRecommendation}
              adaptiveError={adaptiveRecommendationResult?.error}
              achievements={achievements}
              achievementsError={achievementsError}
            />
          )}
        </section>
      </div>
    </main>
  );
}

type StudentDashboardPanelProps = {
  courseDetail: CourseDetail;
  firstLessonLink: string | null;
  adaptiveRecommendation: AdaptiveRecommendation | null;
  adaptiveError?: string;
  achievements: AchievementItem[];
  achievementsError?: string;
};

function StudentDashboardPanel({
  courseDetail,
  firstLessonLink,
  adaptiveRecommendation,
  adaptiveError,
  achievements,
  achievementsError,
}: StudentDashboardPanelProps) {
  return (
    <>
      <div className="space-y-4">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">
            Course details
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {courseDetail.course.title}
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            {courseDetail.course.description}
          </p>
        </div>
        {firstLessonLink ? (
          <PendingLinkButton
            href={firstLessonLink}
            label="Open lesson view"
            pendingLabel="Opening lesson..."
            className="inline-flex rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          />
        ) : null}
      </div>

      {adaptiveError ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-sm leading-7 text-red-700">
          {adaptiveError}
        </div>
      ) : adaptiveRecommendation ? (
        <section className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-700">
                Adaptive next step
              </p>
              <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                {adaptiveRecommendation.nextActionLabel}
              </h3>
              <p className="max-w-2xl text-sm leading-7 text-slate-700">
                {adaptiveRecommendation.reason}
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                <span className="rounded-full bg-white px-3 py-2 text-sky-700">
                  Difficulty: {adaptiveRecommendation.recommendedDifficulty}
                </span>
                <span className="rounded-full bg-white px-3 py-2 text-emerald-700">
                  Pace: {adaptiveRecommendation.recommendedPacing}
                </span>
                <span className="rounded-full bg-white px-3 py-2 text-slate-700">
                  Confidence: {adaptiveRecommendation.confidenceScore}%
                </span>
              </div>
            </div>
            <PendingLinkButton
              href={`/dashboard/courses/${adaptiveRecommendation.courseId}/lessons/${adaptiveRecommendation.recommendedLessonId}`}
              label={`Open ${adaptiveRecommendation.recommendedLessonTitle}`}
              pendingLabel="Opening recommendation..."
              className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <AdaptiveMetricCard label="Completion" value={`${adaptiveRecommendation.metrics.completionPercentage}%`} />
            <AdaptiveMetricCard label="Mastery" value={`${adaptiveRecommendation.metrics.masteryScore}%`} />
            <AdaptiveMetricCard label="Assessment" value={`${adaptiveRecommendation.metrics.assessmentScore}%`} />
          </div>
        </section>
      ) : null}

      <StudentAchievementsPanel achievements={achievements} achievementsError={achievementsError} />

      {courseDetail.lessons.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/40 p-6">
          <h3 className="text-lg font-semibold text-foreground">Lessons will appear here.</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This course exists, but lesson content has not been added yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {courseDetail.lessons.map((lesson, index) => (
            <article
              key={lesson.id}
              className="rounded-[1.5rem] border border-border bg-background p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{lesson.title}</h3>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        {lesson.difficultyLevel}
                      </p>
                    </div>
                  </div>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                    {lesson.content}
                  </p>
                </div>
                <div className="min-w-[220px] space-y-3 rounded-[1.25rem] bg-muted/50 p-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Progress snapshot
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-foreground">
                      {lesson.completionPercentage}%
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Mastery {lesson.masteryScore}%
                    </p>
                  </div>
                  <PendingLinkButton
                    href={`/dashboard/courses/${courseDetail.course.id}/lessons/${lesson.id}`}
                    label="Open lesson"
                    pendingLabel="Opening lesson..."
                    className="inline-flex rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
                  />
                </div>
              </div>
              {courseDetail.canRecordProgress ? (
                <div className="mt-5">
                  <CourseProgressForm
                    courseId={courseDetail.course.id}
                    lessonId={lesson.id}
                    completionPercentage={lesson.completionPercentage}
                    masteryScore={lesson.masteryScore}
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}


type StudentAchievementsPanelProps = {
  achievements: AchievementItem[];
  achievementsError?: string;
};

function StudentAchievementsPanel({
  achievements,
  achievementsError,
}: StudentAchievementsPanelProps) {
  if (achievementsError) {
    return (
      <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-800">
        {achievementsError}
      </section>
    );
  }

  if (achievements.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-dashed border-border bg-muted/30 p-5">
        <h3 className="text-lg font-semibold text-foreground">Achievements will appear here.</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Complete lessons and assessments to unlock badges and milestones.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-emerald-700">
            Gamification
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950">
            Recent achievements
          </h3>
        </div>
        <p className="text-sm leading-6 text-emerald-800">
          {achievements.length} badge{achievements.length === 1 ? "" : "s"} unlocked.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((achievement) => (
          <article key={achievement.id} className="rounded-[1.2rem] border border-emerald-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">
              {achievement.badge ?? "Milestone"}
            </p>
            <h4 className="mt-2 text-base font-semibold text-foreground">{achievement.title}</h4>
            <p className="mt-2 text-xs text-muted-foreground">
              Awarded {achievement.awarded_at ? new Date(achievement.awarded_at).toLocaleDateString() : "recently"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
type TeacherDashboardPanelProps = {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  firstLessonLink: string | null;
  analytics: TeacherCourseAnalytics | null;
  analyticsError?: string;
  students: ManagedStudentOption[];
  lessons: Array<{ id: string; title: string }>;
  parentOptions: ParentOption[];
  canManageParentLinks: boolean;
};

function TeacherDashboardPanel({
  courseId,
  courseTitle,
  courseDescription,
  firstLessonLink,
  analytics,
  analyticsError,
  students,
  lessons,
  parentOptions,
  canManageParentLinks,
}: TeacherDashboardPanelProps) {
  if (analyticsError) {
    return (
      <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-red-700">
        <h2 className="text-xl font-semibold">We couldn&apos;t load class analytics.</h2>
        <p className="mt-2 text-sm leading-6">{analyticsError}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <TeacherAnalyticsRefresh courseId={courseId} />
        <GradebookExportControls courseId={courseId} />
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">
            Course overview
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{courseTitle}</h2>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{courseDescription}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PendingLinkButton
            href={`/dashboard?course=${courseId}`}
            label="Refresh overview"
            pendingLabel="Refreshing..."
            className="inline-flex rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          />
          {firstLessonLink ? (
            <PendingLinkButton
              href={firstLessonLink}
              label="Preview lesson"
              pendingLabel="Opening preview..."
              className="inline-flex rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            />
          ) : null}
          <Link
            href="/api/integrations/lms/courses"
            className="inline-flex rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            LMS course feed
          </Link>
          <Link
            href={`/api/integrations/lms/grades?courseId=${courseId}&scope=full&gradeModel=balanced&format=json`}
            className="inline-flex rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            LMS grade payload
          </Link>
        </div>
      </div>


      <section className="rounded-[1.5rem] border border-border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Classroom management
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Assign learners and keep enrolments current
            </h3>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Quick updates for learner-course assignment and guardian linkage.
          </p>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="space-y-3 rounded-[1.3rem] border border-border/70 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Teacher assignment
            </p>
            {students.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                No learners are available to assign yet.
              </p>
            ) : (
              <AssignStudentForm courseId={courseId} students={students} lessons={lessons} />
            )}
          </div>

          {canManageParentLinks ? (
            <div className="space-y-3 rounded-[1.3rem] border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Parent relationship
              </p>
              {students.length === 0 || parentOptions.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Add parent and learner accounts first to create a linkage.
                </p>
              ) : (
                <LinkParentForm courseId={courseId} parents={parentOptions} students={students} />
              )}
            </div>
          ) : (
            <div className="rounded-[1.3rem] border border-dashed border-border bg-muted/10 p-4 text-sm leading-6 text-muted-foreground">
              Parent-student relationship management is available for admin users.
            </div>
          )}
        </div>
      </section>
      {!analytics ? (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/40 p-6">
          <h3 className="text-lg font-semibold text-foreground">Analytics will appear here.</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Once learners are enrolled and progress begins, this view will show course health and
            support priorities.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Learners" value={String(analytics.totalStudents)} tone="sky" />
            <MetricCard label="Lessons" value={String(analytics.totalLessons)} tone="slate" />
            <MetricCard
              label="Average completion"
              value={`${analytics.averageCompletionPercentage}%`}
              tone="emerald"
            />
            <MetricCard
              label="Need attention"
              value={String(analytics.studentsNeedingAttention)}
              tone="amber"
            />
          </div>

          <section className="rounded-[1.5rem] border border-border bg-background p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Course pulse
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Lesson-by-lesson readiness
                </h3>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Average mastery across the course is {analytics.averageMasteryScore}%.
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {analytics.lessons.map((lesson) => (
                <div
                  key={lesson.lessonId}
                  className="rounded-[1.4rem] border border-border/80 bg-muted/30 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">{lesson.title}</h4>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        {lesson.difficultyLevel}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/courses/${courseId}/lessons/${lesson.lessonId}`}
                      className="text-sm font-semibold text-foreground underline-offset-4 transition hover:underline"
                    >
                      Preview
                    </Link>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <MetricMini label="Completion" value={`${lesson.averageCompletionPercentage}%`} />
                    <MetricMini label="Mastery" value={`${lesson.averageMasteryScore}%`} />
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        Assessment builder
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Create a fresh quiz, assignment, or exam draft aligned to this lesson&apos;s learning goals.
                      </p>
                    </div>
                    <GenerateAssessmentForm courseId={courseId} lessonId={lesson.lessonId} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-border bg-background p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Learner overview
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Who needs support next
                </h3>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Learners below 50% completion or 60% mastery are surfaced for follow-up.
              </p>
            </div>
            {analytics.students.length === 0 ? (
              <div className="mt-6 rounded-[1.4rem] border border-dashed border-border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
                No learners are enrolled in this course yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {analytics.students.map((student) => {
                  const needsAttention =
                    student.completionPercentage < 50 || student.masteryScore < 60;

                  return (
                    <div
                      key={student.studentId}
                      className={`rounded-[1.4rem] border p-5 ${
                        needsAttention
                          ? "border-amber-200 bg-amber-50"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h4 className="text-lg font-semibold text-foreground">
                              {student.displayName}
                            </h4>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {student.gradeLevel}
                            </span>
                            {needsAttention ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                                Attention needed
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {student.completedLessons} completed lessons, {student.activeLessons} with recorded activity.
                          </p>
                        </div>
                        <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
                          <MetricMini label="Completion" value={`${student.completionPercentage}%`} />
                          <MetricMini label="Mastery" value={`${student.masteryScore}%`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "amber" | "slate";
};

function MetricCard({ label, value, tone }: MetricCardProps) {
  const toneClassName =
    tone === "sky"
      ? "bg-sky-50 text-sky-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-700";

  return (
    <div className={`rounded-[1.5rem] p-5 ${toneClassName}`}>
      <p className="text-xs font-medium uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

type MetricMiniProps = {
  label: string;
  value: string;
};

function MetricMini({ label, value }: MetricMiniProps) {
  return (
    <div className="rounded-[1.2rem] border border-border/80 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function AdaptiveMetricCard({ label, value }: MetricMiniProps) {
  return (
    <div className="rounded-[1.3rem] border border-sky-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}







































