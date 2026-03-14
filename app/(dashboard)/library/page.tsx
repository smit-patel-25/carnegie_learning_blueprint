import type { Metadata } from "next";

import Link from "next/link";
import { redirect } from "next/navigation";

import { listCoursesForViewer } from "@/lib/learning/service";
import { getObjectiveMapsForLessons } from "@/lib/learning/pathway";
import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";
import { createClient } from "@/lib/supabase/server";
import type { ObjectiveMap } from "@/lib/validations/pathway";

export const metadata: Metadata = {
  title: "Content Library | Adaptive Learning Intelligence Platform",
  description: "Search, filter, and review learning resources in one protected library.",
};

type LibraryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ViewerRole = "student" | "teacher" | "admin" | "parent";

type ContentItemRow = {
  id: string;
  lesson_id: string;
  type: "video" | "audio" | "text" | "interactive";
  url: string | null;
  metadata: unknown;
  learning_objective_id?: string | null;
};

type LessonRow = {
  id: string;
  title: string;
  course_id: string;
  difficulty_level: string | null;
  content: string | null;
};

type LibraryCourseRow = {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  completionPercentage: number;
  currentLessonId: string | null;
};

type LibraryItem = {
  id: string;
  title: string;
  summary: string;
  type: "video" | "audio" | "text" | "interactive";
  category: string;
  tags: string[];
  url: string | null;
  lessonId: string;
  lessonTitle: string;
  lessonDifficulty: string;
  courseId: string;
  courseTitle: string;
  alignedObjective: string | null;
  standardCode: string | null;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = (await searchParams) ?? {};
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const typeFilter = typeof params.type === "string" ? params.type : "all";
  const categoryFilter = typeof params.category === "string" ? params.category : "all";

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
  const courseListResult = await listCoursesForViewer(supabase);

  if (courseListResult.error) {
    return (
      <main className="container py-12 md:py-16">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
          <h1 className="text-3xl font-semibold">We couldn&apos;t load the content library.</h1>
          <p className="mt-3 text-sm leading-7">{courseListResult.error}</p>
        </div>
      </main>
    );
  }

  const accessibleCourses = (courseListResult.data ?? []) as LibraryCourseRow[];
  const courseMap = new Map(accessibleCourses.map((course) => [course.id, course]));
  const courseIds = accessibleCourses.map((course) => course.id);
  const lessonsResponse =
    courseIds.length === 0
      ? { data: [] as LessonRow[], error: null }
      : await supabase
          .from("lessons")
          .select("id, title, course_id, difficulty_level, content")
          .in("course_id", courseIds)
          .order("created_at", { ascending: true });

  if (lessonsResponse.error) {
    return (
      <main className="container py-12 md:py-16">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
          <h1 className="text-3xl font-semibold">We couldn&apos;t load the content library.</h1>
          <p className="mt-3 text-sm leading-7">{lessonsResponse.error.message}</p>
        </div>
      </main>
    );
  }

  const lessonRows = (lessonsResponse.data ?? []) as LessonRow[];
  const lessonMap = new Map(lessonRows.map((lesson) => [lesson.id, lesson]));
  let libraryNotice = "";

  const objectiveMapsResult = await getObjectiveMapsForLessons(
    supabase,
    lessonRows.map((lesson) => lesson.id),
  );

  if (objectiveMapsResult.error) {
    libraryNotice =
      "Learning objective tags are not available yet, but you can still browse the lesson materials below.";
  }

  const objectiveMapByLesson: Map<string, ObjectiveMap[]> =
    objectiveMapsResult.data ?? new Map<string, ObjectiveMap[]>();
  const contentResponse =
    lessonRows.length === 0
      ? { data: [] as ContentItemRow[], error: null }
      : await supabase
          .from("content_items")
          .select("*")
          .in(
            "lesson_id",
            lessonRows.map((lesson) => lesson.id),
          )
          .order("id", { ascending: true });

  if (contentResponse.error) {
    libraryNotice =
      libraryNotice ||
      "Detailed resource cards are not ready yet for this account, so the library is showing lesson materials you can still use right now.";
  }

  const contentRows = contentResponse.error ? [] : ((contentResponse.data ?? []) as ContentItemRow[]);
  const lessonIdsWithContent = new Set(contentRows.map((item) => item.lesson_id));

  const contentItems = contentRows.reduce<LibraryItem[]>((items, item) => {
    const lesson = lessonMap.get(item.lesson_id);

    if (!lesson) {
      return items;
    }

    const course = courseMap.get(lesson.course_id);
    const metadata =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, unknown>)
        : {};
    const lessonObjectives = objectiveMapByLesson.get(lesson.id) ?? [];
    const objectiveMatch =
      lessonObjectives.find((objective) => objective.id === item.learning_objective_id) ??
      lessonObjectives[0] ??
      null;
    const tags = Array.isArray(metadata.tags)
      ? metadata.tags.filter((tag): tag is string => typeof tag === "string")
      : [];
    const category = typeof metadata.category === "string" ? metadata.category : "Lesson resources";
    const title =
      typeof metadata.title === "string" && metadata.title.trim().length > 0
        ? metadata.title
        : `${capitalize(item.type)} resource`;
    const summary =
      typeof metadata.summary === "string" && metadata.summary.trim().length > 0
        ? metadata.summary
        : `Support material for ${lesson.title}.`;

    items.push({
      id: item.id,
      title,
      summary,
      type: item.type,
      category,
      tags,
      url: item.url,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonDifficulty: lesson.difficulty_level ?? "Core",
      courseId: lesson.course_id,
      courseTitle: course?.title ?? "Course",
      alignedObjective: objectiveMatch?.objective ?? null,
      standardCode: objectiveMatch?.standardCode ?? null,
    });

    return items;
  }, []);

  const fallbackItems = lessonRows
    .filter((lesson) => !lessonIdsWithContent.has(lesson.id))
    .map<LibraryItem>((lesson) => {
      const objective = (objectiveMapByLesson.get(lesson.id) ?? [])[0] ?? null;

      return {
        id: `lesson-${lesson.id}`,
        title: `${lesson.title} lesson guide`,
        summary:
          lesson.content?.trim().slice(0, 180) ||
          "Core lesson material is available here even while richer resource cards are still being prepared.",
        type: "text",
        category: "Lesson materials",
        tags: [lesson.difficulty_level ?? "Core"],
        url: null,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonDifficulty: lesson.difficulty_level ?? "Core",
        courseId: lesson.course_id,
        courseTitle: courseMap.get(lesson.course_id)?.title ?? "Course",
        alignedObjective: objective?.objective ?? null,
        standardCode: objective?.standardCode ?? null,
      };
    });

  const libraryItems = [...contentItems, ...fallbackItems];
  const categoryOptions = [...new Set(libraryItems.map((item) => item.category))].sort((a, b) =>
    a.localeCompare(b),
  );

  const filteredItems = libraryItems.filter((item) => {
    const matchesSearch =
      search.length === 0
        ? true
        : [
            item.title,
            item.summary,
            item.courseTitle,
            item.lessonTitle,
            item.category,
            item.tags.join(" "),
            item.alignedObjective ?? "",
            item.standardCode ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase());
    const matchesType = typeFilter === "all" ? true : item.type === typeFilter;
    const matchesCategory = categoryFilter === "all" ? true : item.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const typeCounts = {
    video: libraryItems.filter((item) => item.type === "video").length,
    audio: libraryItems.filter((item) => item.type === "audio").length,
    text: libraryItems.filter((item) => item.type === "text").length,
    interactive: libraryItems.filter((item) => item.type === "interactive").length,
  };

  const heroTitle =
    viewerRole === "teacher" || viewerRole === "admin"
      ? "Keep every learning resource easy to find."
      : "Review your learning resources in one place.";
  const heroDescription =
    viewerRole === "teacher" || viewerRole === "admin"
      ? "Search course materials, filter by format or category, and jump straight into the lesson context that needs attention."
      : "Browse the materials available to you, narrow by format, and reopen the exact lesson context you need next.";

  return (
    <main className="container py-12 md:py-16">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div className="space-y-4">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-primary/70">
                Content library
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                {heroTitle}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
                {heroDescription}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <LibraryStat label="Video" value={String(typeCounts.video)} tone="sky" />
              <LibraryStat label="Audio" value={String(typeCounts.audio)} tone="emerald" />
              <LibraryStat label="Text" value={String(typeCounts.text)} tone="slate" />
              <LibraryStat label="Interactive" value={String(typeCounts.interactive)} tone="amber" />
            </div>
          </div>

          {libraryNotice ? (
            <div className="mt-6 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {libraryNotice}
            </div>
          ) : null}

          <form className="mt-8 grid gap-4 rounded-[1.6rem] border border-border/70 bg-background/70 p-5 md:grid-cols-[minmax(0,1.4fr)_0.8fr_0.8fr_auto] md:items-end">
            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Search
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Search by title, course, lesson, objective, standard"
                className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
              />
            </label>
            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Format
              <select
                name="type"
                defaultValue={typeFilter}
                className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
              >
                <option value="all">All formats</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="text">Text</option>
                <option value="interactive">Interactive</option>
              </select>
            </label>
            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Category
              <select
                name="category"
                defaultValue={categoryFilter}
                className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
              >
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apply filters
              </button>
              <Link
                href="/library"
                className="inline-flex rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>

        <section className="space-y-4 rounded-[2rem] border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Results
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {filteredItems.length} resources available
              </h2>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Access is role-scoped: you only see resources available to your account.
            </p>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-border bg-muted/30 p-6 text-sm leading-7 text-muted-foreground">
              {accessibleCourses.length === 0
                ? "There are no course materials assigned to this account yet."
                : "No resources matched the current filters. Reset the search or broaden the selected format/category."}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[1.6rem] border border-border bg-background p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${typeToneClass(item.type)}`}>
                      {item.type}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {item.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {item.lessonDifficulty}
                    </span>
                    {item.standardCode ? (
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                        {item.standardCode}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.summary}</p>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <p>
                        <span className="font-semibold text-foreground">Course:</span> {item.courseTitle}
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">Lesson:</span> {item.lessonTitle}
                      </p>
                      {item.alignedObjective ? (
                        <p>
                          <span className="font-semibold text-foreground">Aligned objective:</span> {item.alignedObjective}
                        </p>
                      ) : null}
                    </div>
                    {item.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <span
                            key={`${item.id}-${tag}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/dashboard/courses/${item.courseId}/lessons/${item.lessonId}`}
                      className="inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                    >
                      Open lesson
                    </Link>
                    {item.url ? (
                      <Link
                        href={item.url}
                        className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Open resource
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

type LibraryStatProps = {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "amber" | "slate";
};

function LibraryStat({ label, value, tone }: LibraryStatProps) {
  const toneClassName =
    tone === "sky"
      ? "bg-sky-50 text-sky-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-700";

  return (
    <div className={`rounded-[1.5rem] p-4 ${toneClassName}`}>
      <p className="text-xs font-medium uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function typeToneClass(type: LibraryItem["type"]) {
  switch (type) {
    case "video":
      return "bg-sky-50 text-sky-700";
    case "audio":
      return "bg-emerald-50 text-emerald-700";
    case "interactive":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}



