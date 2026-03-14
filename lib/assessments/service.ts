import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLearningPathForStudent } from "@/lib/learning/pathway";
import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";
import {
  assessmentSubmissionInputSchema,
  assessmentSubmissionResultSchema,
  lessonAssessmentExperienceSchema,
  lessonAssessmentSchema,
  type AssessmentSubmissionInput,
  type AssessmentSubmissionResult,
  type LessonAssessmentExperience,
} from "@/lib/validations/assessment";

type ServiceResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

type ViewerRole = "student" | "teacher" | "admin" | "parent";

type ViewerContext = {
  role: ViewerRole;
  studentId: string | null;
};

type AssessmentRow = {
  id: string;
  lesson_id: string;
  type: "quiz" | "assignment" | "exam";
  created_at: string;
};

type QuestionRow = {
  id: string;
  assessment_id: string;
  question_text: string;
  difficulty: string | null;
  correct_answer: string | null;
  explanation: string | null;
};

type SubmissionRow = {
  assessment_id: string;
  score: number | null;
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

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function buildHint(question: QuestionRow) {
  const explanationLead = question.explanation?.split(".")[0]?.trim();

  if ((question.difficulty ?? "").toLowerCase() === "stretch") {
    return explanationLead
      ? `Break the problem into parts, decide what evidence supports each step, then justify your conclusion. ${explanationLead}.`
      : "Break the prompt into parts, decide what evidence matters most, then justify each step clearly.";
  }

  if ((question.difficulty ?? "").toLowerCase() === "support") {
    return explanationLead
      ? `Start with the main idea in the prompt, then connect it to one worked example. ${explanationLead}.`
      : "Start with the main idea in the prompt, then connect it to one worked example before writing your full answer.";
  }

  return explanationLead
    ? `Focus on the key concept the question is checking, then explain why your answer fits. ${explanationLead}.`
    : "Focus on the key concept the question is checking, then explain why your answer fits the prompt.";
}

function scoreAnswer(answer: string, referenceText: string) {
  const answerTokens = new Set(tokenize(answer));
  const referenceTokens = Array.from(new Set(tokenize(referenceText)));

  if (answerTokens.size === 0 || referenceTokens.length === 0) {
    return 0;
  }

  const overlap = referenceTokens.filter((token) => answerTokens.has(token)).length;
  const target = Math.max(3, Math.min(referenceTokens.length, 6));
  const coverage = Math.min(overlap / target, 1);
  const depthBoost = answerTokens.size >= 6 ? 0.12 : answerTokens.size >= 3 ? 0.05 : 0;

  return Math.round(Math.min(1, coverage + depthBoost) * 100);
}

export async function getLessonAssessmentExperienceForViewer(
  supabase: SupabaseClient,
  input: { courseId: string; lessonId: string },
): Promise<ServiceResult<LessonAssessmentExperience>> {
  const viewerResult = await getViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your account context could not be resolved." };
  }

  const lessonResponse = await supabase
    .from("lessons")
    .select("id, course_id")
    .eq("id", input.lessonId)
    .maybeSingle();

  if (lessonResponse.error || !lessonResponse.data) {
    return { error: "That lesson could not be loaded." };
  }

  if (lessonResponse.data.course_id !== input.courseId) {
    return { error: "The selected lesson does not belong to that course." };
  }

  const assessmentsResponse = await supabase
    .from("assessments")
    .select("id, lesson_id, type, created_at")
    .eq("lesson_id", input.lessonId)
    .order("created_at", { ascending: false });

  if (assessmentsResponse.error) {
    return { error: "Assessment details could not be loaded." };
  }

  const assessments = (assessmentsResponse.data ?? []) as AssessmentRow[];

  if (assessments.length === 0) {
    return {
      data: lessonAssessmentExperienceSchema.parse({
        courseId: input.courseId,
        lessonId: input.lessonId,
        viewerRole: viewer.role,
        activeAssessment: null,
      }),
    };
  }

  const activeAssessment = assessments[0];
  const questionsResponse = await supabase
    .from("questions")
    .select("id, assessment_id, question_text, difficulty, correct_answer, explanation")
    .eq("assessment_id", activeAssessment.id)
    .order("id", { ascending: true });

  if (questionsResponse.error) {
    return { error: "Assessment questions could not be loaded." };
  }

  const questions = (questionsResponse.data ?? []) as QuestionRow[];
  let submission: SubmissionRow | null = null;

  if (viewer.role === "student" && viewer.studentId) {
    const submissionResponse = await supabase
      .from("submissions")
      .select("assessment_id, score")
      .eq("student_id", viewer.studentId)
      .eq("assessment_id", activeAssessment.id)
      .maybeSingle();

    if (submissionResponse.error && submissionResponse.error.code !== "PGRST116") {
      return { error: "Assessment progress could not be loaded." };
    }

    submission = (submissionResponse.data ?? null) as SubmissionRow | null;
  }

  return {
    data: lessonAssessmentExperienceSchema.parse({
      courseId: input.courseId,
      lessonId: input.lessonId,
      viewerRole: viewer.role,
      activeAssessment: lessonAssessmentSchema.parse({
        assessmentId: activeAssessment.id,
        lessonId: activeAssessment.lesson_id,
        type: activeAssessment.type,
        createdAt: activeAssessment.created_at,
        questionCount: questions.length,
        alreadySubmitted: Boolean(submission),
        score: submission?.score ?? null,
        questions: questions.map((question) => ({
          id: question.id,
          questionText: question.question_text,
          difficulty: question.difficulty ?? "Core",
          explanation: question.explanation,
          hint: buildHint(question),
        })),
      }),
    }),
  };
}

export async function submitAssessmentForViewer(
  supabase: SupabaseClient,
  input: AssessmentSubmissionInput,
): Promise<ServiceResult<AssessmentSubmissionResult>> {
  const parsedInput = assessmentSubmissionInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return { error: parsedInput.error.issues[0]?.message ?? "Invalid assessment submission." };
  }

  const viewerResult = await getViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your account context could not be resolved." };
  }

  if (viewer.role !== "student" || !viewer.studentId) {
    return { error: "Only students can submit assessments." };
  }

  const assessmentResponse = await supabase
    .from("assessments")
    .select("id, lesson_id")
    .eq("id", parsedInput.data.assessmentId)
    .maybeSingle();

  if (assessmentResponse.error || !assessmentResponse.data) {
    return { error: "That assessment could not be found." };
  }

  if (assessmentResponse.data.lesson_id !== parsedInput.data.lessonId) {
    return { error: "The selected assessment does not belong to that lesson." };
  }

  const lessonResponse = await supabase
    .from("lessons")
    .select("id, course_id")
    .eq("id", parsedInput.data.lessonId)
    .maybeSingle();

  if (lessonResponse.error || !lessonResponse.data) {
    return { error: "That lesson could not be loaded." };
  }

  if (lessonResponse.data.course_id !== parsedInput.data.courseId) {
    return { error: "The selected lesson does not belong to that course." };
  }

  const questionsResponse = await supabase
    .from("questions")
    .select("id, question_text, difficulty, correct_answer, explanation")
    .eq("assessment_id", parsedInput.data.assessmentId)
    .order("id", { ascending: true });

  if (questionsResponse.error) {
    return { error: "Assessment questions could not be loaded." };
  }

  const questions = (questionsResponse.data ?? []) as Array<
    Pick<QuestionRow, "id" | "question_text" | "difficulty" | "correct_answer" | "explanation">
  >;

  if (questions.length === 0) {
    return { error: "This assessment does not have any questions yet." };
  }

  const answerMap = new Map(parsedInput.data.answers.map((answer) => [answer.questionId, answer.answer]));
  const perQuestionScores = questions.map((question) => {
    const answer = answerMap.get(question.id) ?? "";
    const referenceText = [question.correct_answer, question.explanation, question.question_text]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ");

    return scoreAnswer(answer, referenceText);
  });

  const score = Math.round(
    perQuestionScores.reduce((sum, current) => sum + current, 0) / perQuestionScores.length,
  );

  const submissionResponse = await supabase.from("submissions").upsert(
    {
      student_id: viewer.studentId,
      assessment_id: parsedInput.data.assessmentId,
      score,
      submitted_at: new Date().toISOString(),
    },
    {
      onConflict: "student_id,assessment_id",
    },
  );

  if (submissionResponse.error) {
    return { error: "Your assessment could not be submitted." };
  }

  const pathSyncResult = await syncLearningPathForStudent(supabase, {
    studentId: viewer.studentId,
    courseId: parsedInput.data.courseId,
    lessonId: parsedInput.data.lessonId,
    assessmentScore: score,
  });

  if (pathSyncResult.error) {
    return { error: pathSyncResult.error };
  }

  const advancedToNextLesson = pathSyncResult.data?.currentLessonId !== parsedInput.data.lessonId;

  return {
    data: assessmentSubmissionResultSchema.parse({
      assessmentId: parsedInput.data.assessmentId,
      courseId: parsedInput.data.courseId,
      lessonId: parsedInput.data.lessonId,
      score,
      answeredQuestions: parsedInput.data.answers.length,
      message:
        score >= 85
          ? advancedToNextLesson
            ? "Assessment submitted. Strong work - your learning path is ready for the next lesson."
            : "Assessment submitted. Strong work - you are ready to keep moving."
          : score >= 60
            ? "Assessment submitted. You are on track, and the hints can help sharpen the next revision."
            : "Assessment submitted. Review the hints and lesson notes, then try again to strengthen this concept.",
    }),
  };
}







