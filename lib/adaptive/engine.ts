import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";

import {
  adaptiveRecommendationQuerySchema,
  adaptiveRecommendationSchema,
  type AdaptiveRecommendation,
  type AdaptiveRecommendationQuery,
} from "@/lib/validations/adaptive";
import { courseSchema, learningPathSchema, lessonSchema, progressSchema, submissionSchema } from "@/lib/validations/learning";

type ServiceResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

type AssessmentRow = {
  id: string;
  lesson_id: string;
};

async function getStudentViewerContext(supabase: SupabaseClient): Promise<ServiceResult<{ studentId: string }>> {
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

  const role = profileResponse.data?.role ?? ensuredContext?.role ?? "student";

  if (role !== "student") {
    return { error: "Adaptive recommendations are available for student accounts only." };
  }

  const studentResponse = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (studentResponse.error || !studentResponse.data || studentResponse.data.length === 0) {
    return { error: "Your student record could not be loaded." };
  }

  return { data: { studentId: studentResponse.data[0].id } };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function getAdaptiveRecommendationsForViewer(
  supabase: SupabaseClient,
  input: AdaptiveRecommendationQuery = {},
): Promise<ServiceResult<AdaptiveRecommendation[]>> {
  const parsedInput = adaptiveRecommendationQuerySchema.safeParse(input);

  if (!parsedInput.success) {
    return { error: parsedInput.error.issues[0]?.message ?? "Invalid recommendation request." };
  }

  const viewerResult = await getStudentViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your student context could not be resolved." };
  }

  const learningPathsQuery = supabase
    .from("learning_paths")
    .select("student_id, course_id, current_lesson_id")
    .eq("student_id", viewer.studentId);

  const learningPathsResponse = parsedInput.data.courseId
    ? await learningPathsQuery.eq("course_id", parsedInput.data.courseId)
    : await learningPathsQuery;

  if (learningPathsResponse.error) {
    return { error: "Learning paths could not be loaded." };
  }

  const learningPaths = learningPathSchema.array().parse(learningPathsResponse.data ?? []);
  const courseIds = [...new Set(learningPaths.map((path) => path.course_id))];

  if (courseIds.length === 0) {
    return { data: [] };
  }

  const courseResponse = await supabase
    .from("courses")
    .select("id, title, description, teacher_id, curriculum_id, created_at")
    .in("id", courseIds)
    .order("created_at", { ascending: false });

  if (courseResponse.error) {
    return { error: "Courses could not be loaded." };
  }

  const courses = courseSchema.array().parse(courseResponse.data ?? []);
  const lessonsResponse = await supabase
    .from("lessons")
    .select("id, course_id, title, content, difficulty_level, created_at")
    .in("course_id", courseIds)
    .order("created_at", { ascending: true });

  if (lessonsResponse.error) {
    return { error: "Lessons could not be loaded." };
  }

  const lessons = lessonSchema.array().parse(lessonsResponse.data ?? []);
  const lessonIds = lessons.map((lesson) => lesson.id);

  const progressResponse = lessonIds.length === 0
    ? { data: [], error: null }
    : await supabase
        .from("progress_tracking")
        .select("id, student_id, lesson_id, completion_percentage, mastery_score, last_accessed")
        .eq("student_id", viewer.studentId)
        .in("lesson_id", lessonIds);

  if (progressResponse.error) {
    return { error: "Progress data could not be loaded." };
  }

  const progressRows = progressSchema.array().parse(progressResponse.data ?? []);

  const assessmentsResponse = lessonIds.length === 0
    ? { data: [] as AssessmentRow[], error: null }
    : await supabase
        .from("assessments")
        .select("id, lesson_id")
        .in("lesson_id", lessonIds);

  if (assessmentsResponse.error) {
    return { error: "Assessments could not be loaded." };
  }

  const assessments = (assessmentsResponse.data ?? []) as AssessmentRow[];
  const assessmentIds = assessments.map((assessment) => assessment.id);

  const submissionsResponse = assessmentIds.length === 0
    ? { data: [], error: null }
    : await supabase
        .from("submissions")
        .select("id, student_id, assessment_id, score, submitted_at")
        .eq("student_id", viewer.studentId)
        .in("assessment_id", assessmentIds);

  if (submissionsResponse.error) {
    return { error: "Assessment results could not be loaded." };
  }

  const submissions = submissionSchema.array().parse(submissionsResponse.data ?? []);
  const lessonsByCourse = new Map<string, typeof lessons>();
  const progressByLesson = new Map(progressRows.map((row) => [row.lesson_id, row]));
  const assessmentLessonMap = new Map(assessments.map((assessment) => [assessment.id, assessment.lesson_id]));
  const assessmentScoresByLesson = new Map<string, number[]>();

  lessons.forEach((lesson) => {
    const group = lessonsByCourse.get(lesson.course_id) ?? [];
    group.push(lesson);
    lessonsByCourse.set(lesson.course_id, group);
  });

  submissions.forEach((submission) => {
    const lessonId = assessmentLessonMap.get(submission.assessment_id);

    if (!lessonId) {
      return;
    }

    const group = assessmentScoresByLesson.get(lessonId) ?? [];
    group.push(Number(submission.score ?? 0));
    assessmentScoresByLesson.set(lessonId, group);
  });

  const recommendations = courses.flatMap((course) => {
    const lessonGroup = lessonsByCourse.get(course.id) ?? [];

    if (lessonGroup.length === 0) {
      return [];
    }

    const learningPath = learningPaths.find((path) => path.course_id === course.id) ?? null;
    const firstIncompleteLesson = lessonGroup.find((lesson) => {
      return (progressByLesson.get(lesson.id)?.completion_percentage ?? 0) < 100;
    });
    const activeLessonId = learningPath?.current_lesson_id ?? firstIncompleteLesson?.id ?? lessonGroup[0]?.id;
    const activeLessonIndex = lessonGroup.findIndex((lesson) => lesson.id === activeLessonId);
    const safeIndex = activeLessonIndex >= 0 ? activeLessonIndex : 0;
    const activeLesson = lessonGroup[safeIndex];
    const nextLesson = lessonGroup[safeIndex + 1] ?? null;
    const progress = progressByLesson.get(activeLesson.id);
    const completionPercentage = clampPercent(progress?.completion_percentage ?? 0);
    const masteryScore = clampPercent(progress?.mastery_score ?? 0);
    const assessmentScore = clampPercent(average(assessmentScoresByLesson.get(activeLesson.id) ?? []));

    let recommendedLesson = activeLesson;
    let recommendedDifficulty: AdaptiveRecommendation["recommendedDifficulty"] = "core";
    let recommendedPacing: AdaptiveRecommendation["recommendedPacing"] = "steady";
    let reason = "Stay with the current lesson to build steady understanding before moving on.";
    let nextActionLabel = "Keep building mastery";

    if (completionPercentage < 50 || masteryScore < 60 || assessmentScore < 60) {
      recommendedDifficulty = "support";
      recommendedPacing = "slow";
      reason = "Recent progress or assessment signals show this concept needs more guided reinforcement before the pace increases.";
      nextActionLabel = "Review the lesson with support";
    } else if (completionPercentage >= 85 && masteryScore >= 85 && assessmentScore >= 85 && nextLesson) {
      recommendedLesson = nextLesson;
      recommendedDifficulty = "stretch";
      recommendedPacing = "accelerate";
      reason = "Strong completion, mastery, and assessment signals suggest you are ready for a more advanced next step.";
      nextActionLabel = "Advance to the next challenge";
    } else if (nextLesson) {
      recommendedLesson = nextLesson;
      recommendedDifficulty = "core";
      recommendedPacing = "steady";
      reason = "Current progress suggests a stable pace: consolidate this lesson and continue into the next concept.";
      nextActionLabel = "Continue to the next lesson";
    }

    const confidenceScore = clampPercent((completionPercentage + masteryScore + assessmentScore) / 3);

    return [
      adaptiveRecommendationSchema.parse({
        courseId: course.id,
        courseTitle: course.title,
        recommendedLessonId: recommendedLesson.id,
        recommendedLessonTitle: recommendedLesson.title,
        recommendedDifficulty,
        recommendedPacing,
        confidenceScore,
        reason,
        nextActionLabel,
        metrics: {
          completionPercentage,
          masteryScore,
          assessmentScore,
        },
      }),
    ];
  });

  return { data: recommendations };
}







