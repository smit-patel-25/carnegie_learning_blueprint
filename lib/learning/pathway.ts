import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";

import {
  lessonPathwaySchema,
  objectiveMapSchema,
  type LessonPathway,
  type ObjectiveMap,
} from "@/lib/validations/pathway";

type ServiceResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

type ViewerRole = "student" | "teacher" | "admin" | "parent";

type ViewerContext = {
  role: ViewerRole;
  studentId: string | null;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  created_at: string;
};

type LearningPathRow = {
  id: string;
  student_id: string;
  course_id: string;
  current_lesson_id: string | null;
};

type ObjectiveRow = {
  id: string;
  lesson_id: string;
  objective: string;
  competency_id?: string | null;
  standard_id?: string | null;
};

type CompetencyRow = {
  id: string;
  description: string | null;
};

type StandardRow = {
  id: string;
  code: string;
  description: string | null;
};

async function getViewerContext(
  supabase: SupabaseClient,
): Promise<ServiceResult<ViewerContext>> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to continue." };
  }

  const ensuredContext = await ensureViewerRoleRecordsForUser({
    userId: user.id,
    metadataRole: user.user_metadata?.role,
  });

  const profileResponse = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResponse.error && !ensuredContext) {
    return { error: "Your profile could not be loaded." };
  }

  let studentId: string | null = null;
  const role = (profileResponse.data?.role ?? ensuredContext?.role ?? "student") as ViewerRole;

  if (role === "student") {
    const studentResponse = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (studentResponse.error) {
      return { error: "Your student record could not be loaded." };
    }

    studentId = studentResponse.data?.[0]?.id ?? null;
  }

  return {
    data: {
      role,
      studentId,
    },
  };
}

export async function getObjectiveMapsForLessons(
  supabase: SupabaseClient,
  lessonIds: string[],
): Promise<ServiceResult<Map<string, ObjectiveMap[]>>> {
  if (lessonIds.length === 0) {
    return { data: new Map() };
  }

  const objectivesResponse = await supabase
    .from("learning_objectives")
    .select("*")
    .in("lesson_id", lessonIds)
    .order("objective", { ascending: true });

  if (objectivesResponse.error) {
    return { error: "Learning objectives could not be loaded." };
  }

  const objectives = (objectivesResponse.data ?? []) as ObjectiveRow[];
  const competencyIds = [...new Set(objectives.map((objective) => objective.competency_id).filter(Boolean))] as string[];
  const standardIds = [...new Set(objectives.map((objective) => objective.standard_id).filter(Boolean))] as string[];

  const competenciesResponse = competencyIds.length === 0
    ? { data: [] as CompetencyRow[], error: null }
    : await supabase
        .from("competencies")
        .select("id, description")
        .in("id", competencyIds);

  if (competenciesResponse.error) {
    return { error: "Competency mappings could not be loaded." };
  }

  const standardsResponse = standardIds.length === 0
    ? { data: [] as StandardRow[], error: null }
    : await supabase
        .from("standards")
        .select("id, code, description")
        .in("id", standardIds);

  const competencyMap = new Map(
    ((competenciesResponse.data ?? []) as CompetencyRow[]).map((competency) => [competency.id, competency]),
  );
  const standardMap = new Map(
    (standardsResponse.error ? [] : ((standardsResponse.data ?? []) as StandardRow[])).map((standard) => [standard.id, standard]),
  );
  const grouped = new Map<string, ObjectiveMap[]>();

  objectives.forEach((objective) => {
    const entry = objectiveMapSchema.parse({
      id: objective.id,
      lessonId: objective.lesson_id,
      objective: objective.objective,
      competency: objective.competency_id ? (competencyMap.get(objective.competency_id)?.description ?? null) : null,
      standardCode: objective.standard_id ? (standardMap.get(objective.standard_id)?.code ?? null) : null,
      standardDescription: objective.standard_id
        ? (standardMap.get(objective.standard_id)?.description ?? null)
        : null,
    });
    const current = grouped.get(objective.lesson_id) ?? [];
    current.push(entry);
    grouped.set(objective.lesson_id, current);
  });

  return { data: grouped };
}

export async function getLessonPathwayForViewer(
  supabase: SupabaseClient,
  input: { courseId: string; lessonId: string },
): Promise<ServiceResult<LessonPathway | null>> {
  const viewerResult = await getViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your account context could not be resolved." };
  }

  const lessonsResponse = await supabase
    .from("lessons")
    .select("id, course_id, title, created_at")
    .eq("course_id", input.courseId)
    .order("created_at", { ascending: true });

  if (lessonsResponse.error) {
    return { error: "Lesson path details could not be loaded." };
  }

  const lessons = (lessonsResponse.data ?? []) as LessonRow[];
  const activeIndex = lessons.findIndex((lesson) => lesson.id === input.lessonId);

  if (activeIndex === -1) {
    return { data: null };
  }

  const objectiveMapsResult = await getObjectiveMapsForLessons(supabase, [input.lessonId]);

  if (objectiveMapsResult.error) {
    return objectiveMapsResult;
  }

  const assessmentsResponse = await supabase
    .from("assessments")
    .select("id")
    .eq("lesson_id", input.lessonId);

  if (assessmentsResponse.error) {
    return { error: "Assessment alignment could not be loaded." };
  }

  let currentLessonId: string | null = null;

  if (viewer.role === "student" && viewer.studentId) {
    const learningPathResponse = await supabase
      .from("learning_paths")
      .select("id, student_id, course_id, current_lesson_id")
      .eq("student_id", viewer.studentId)
      .eq("course_id", input.courseId)
      .maybeSingle();

    if (learningPathResponse.error && learningPathResponse.error.code !== "PGRST116") {
      return { error: "Learning path could not be loaded." };
    }

    currentLessonId = ((learningPathResponse.data ?? null) as LearningPathRow | null)?.current_lesson_id ?? null;
  }

  const progressState = currentLessonId === null
    ? "not-started"
    : currentLessonId === input.lessonId
      ? "current-focus"
      : "ready-to-advance";

  return {
    data: lessonPathwaySchema.parse({
      courseId: input.courseId,
      lessonId: input.lessonId,
      currentLessonId,
      activePosition: activeIndex + 1,
      totalLessons: Math.max(lessons.length, 1),
      progressState,
      assessmentCount: (assessmentsResponse.data ?? []).length,
      objectives: Array.from(objectiveMapsResult.data?.get(input.lessonId) ?? []),
    }),
  };
}

export async function syncLearningPathForStudent(
  supabase: SupabaseClient,
  input: {
    studentId: string;
    courseId: string;
    lessonId: string;
    completionPercentage?: number | null;
    assessmentScore?: number | null;
  },
): Promise<ServiceResult<{ currentLessonId: string }>> {
  const lessonsResponse = await supabase
    .from("lessons")
    .select("id, course_id, title, created_at")
    .eq("course_id", input.courseId)
    .order("created_at", { ascending: true });

  if (lessonsResponse.error) {
    return { error: "Learning path could not be updated." };
  }

  const lessons = (lessonsResponse.data ?? []) as LessonRow[];
  const currentIndex = lessons.findIndex((lesson) => lesson.id === input.lessonId);

  if (currentIndex === -1) {
    return { error: "That lesson does not belong to the selected course." };
  }

  const nextLesson = lessons[currentIndex + 1] ?? null;
  const shouldAdvance =
    (typeof input.completionPercentage === "number" && input.completionPercentage >= 100) ||
    (typeof input.assessmentScore === "number" && input.assessmentScore >= 70);
  const currentLessonId = shouldAdvance ? (nextLesson?.id ?? input.lessonId) : input.lessonId;

  const learningPathResponse = await supabase
    .from("learning_paths")
    .select("id, student_id, course_id, current_lesson_id")
    .eq("student_id", input.studentId)
    .eq("course_id", input.courseId)
    .maybeSingle();

  if (learningPathResponse.error && learningPathResponse.error.code !== "PGRST116") {
    return { error: "Learning path could not be updated." };
  }

  if (learningPathResponse.data) {
    const updateResponse = await supabase
      .from("learning_paths")
      .update({ current_lesson_id: currentLessonId })
      .eq("id", (learningPathResponse.data as LearningPathRow).id);

    if (updateResponse.error) {
      return { error: "Learning path could not be updated." };
    }
  } else {
    const insertResponse = await supabase.from("learning_paths").insert({
      student_id: input.studentId,
      course_id: input.courseId,
      current_lesson_id: currentLessonId,
    });

    if (insertResponse.error) {
      return { error: "Learning path could not be created." };
    }
  }

  return { data: { currentLessonId } };
}










