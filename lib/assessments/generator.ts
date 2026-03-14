import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";

import {
  assessmentGenerationInputSchema,
  generatedAssessmentSchema,
  type AssessmentGenerationInput,
  type GeneratedAssessment,
} from "@/lib/validations/assessment";

type ServiceResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

type ViewerRole = "student" | "teacher" | "admin" | "parent";

type ObjectiveRow = {
  id: string;
  objective: string;
  competency_id: string | null;
  standard_id?: string | null;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  difficulty_level: string | null;
};

async function getAssessmentAuthorContext(
  supabase: SupabaseClient,
): Promise<ServiceResult<{ role: ViewerRole }>> {
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

  return {
    data: {
      role: (profileResponse.data?.role ?? ensuredContext?.role ?? "student") as ViewerRole,
    },
  };
}
function normalizeDifficulty(
  value: string | null,
  assessmentType: AssessmentGenerationInput["type"],
) {
  if (assessmentType === "exam") {
    return "stretch";
  }

  if (assessmentType === "assignment") {
    return value ?? "core";
  }

  return value ?? "support";
}

function buildQuestionText(
  assessmentType: AssessmentGenerationInput["type"],
  lessonTitle: string,
  objective: string,
  questionNumber: number,
) {
  if (assessmentType === "assignment") {
    return `Assignment ${questionNumber}: Apply ${objective.toLowerCase()} in the context of ${lessonTitle}. Show your reasoning clearly.`;
  }

  if (assessmentType === "exam") {
    return `Exam question ${questionNumber}: Analyze how ${objective.toLowerCase()} supports success in ${lessonTitle}, then justify your answer.`;
  }

  return `Quiz question ${questionNumber}: What demonstrates understanding of ${objective.toLowerCase()} in ${lessonTitle}?`;
}

function buildAnswerKey(
  assessmentType: AssessmentGenerationInput["type"],
  objective: string,
) {
  if (assessmentType === "assignment") {
    return `A complete response accurately applies ${objective.toLowerCase()} with a clear worked explanation.`;
  }

  if (assessmentType === "exam") {
    return `A strong answer explains ${objective.toLowerCase()}, connects it to the prompt, and justifies the conclusion with evidence.`;
  }

  return `The correct answer identifies the key concept behind ${objective.toLowerCase()} and applies it accurately.`;
}

function buildExplanation(objective: string) {
  return `Aligned objective: ${objective}. Use this item to confirm understanding before moving forward.`;
}

export async function generateAssessmentForViewer(
  supabase: SupabaseClient,
  input: AssessmentGenerationInput,
): Promise<ServiceResult<GeneratedAssessment>> {
  const parsedInput = assessmentGenerationInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return { error: parsedInput.error.issues[0]?.message ?? "Invalid assessment request." };
  }

  const viewerResult = await getAssessmentAuthorContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your authoring context could not be resolved." };
  }

  if (viewer.role !== "teacher" && viewer.role !== "admin") {
    return { error: "Only teachers or admins can generate assessments." };
  }

  const lessonResponse = await supabase
    .from("lessons")
    .select("id, course_id, title, difficulty_level")
    .eq("id", parsedInput.data.lessonId)
    .maybeSingle();

  if (lessonResponse.error || !lessonResponse.data) {
    return { error: "That lesson could not be found." };
  }

  const lesson = lessonResponse.data as LessonRow;

  if (lesson.course_id !== parsedInput.data.courseId) {
    return { error: "The selected lesson does not belong to that course." };
  }

  const objectivesResponse = await supabase
    .from("learning_objectives")
    .select("*")
    .eq("lesson_id", lesson.id)
    .order("objective", { ascending: true });

  if (objectivesResponse.error) {
    return { error: "Learning objectives could not be loaded." };
  }

  const objectives = (objectivesResponse.data ?? []) as ObjectiveRow[];
  const seededObjectives =
    objectives.length > 0
      ? objectives
      : [
          {
            id: lesson.id,
            objective: `demonstrate core understanding of ${lesson.title}`,
            competency_id: null,
            standard_id: null,
          },
        ];

  const assessmentInsert = await supabase
    .from("assessments")
    .insert({
      lesson_id: lesson.id,
      type: parsedInput.data.type,
    })
    .select("id, lesson_id, type")
    .single();

  if (assessmentInsert.error || !assessmentInsert.data) {
    return { error: "Assessment generation could not be started." };
  }

  const questionPayload = Array.from({ length: parsedInput.data.questionCount }, (_, index) => {
    const sourceObjective = seededObjectives[index % seededObjectives.length];

    return {
      assessment_id: assessmentInsert.data.id,
      learning_objective_id: sourceObjective.id,
      question_text: buildQuestionText(
        parsedInput.data.type,
        lesson.title,
        sourceObjective.objective,
        index + 1,
      ),
      difficulty: normalizeDifficulty(lesson.difficulty_level, parsedInput.data.type),
      correct_answer: buildAnswerKey(parsedInput.data.type, sourceObjective.objective),
      explanation: buildExplanation(sourceObjective.objective),
    };
  });

  let questionsInsert = await supabase.from("questions").insert(questionPayload).select("id");

  if (questionsInsert.error) {
    const fallbackPayload = questionPayload.map((question) => {
      const { learning_objective_id, ...fallbackQuestion } = question;
      void learning_objective_id;
      return fallbackQuestion;
    });
    questionsInsert = await supabase.from("questions").insert(fallbackPayload).select("id");
  }

  if (questionsInsert.error) {
    return { error: "Assessment questions could not be generated." };
  }

  return {
    data: generatedAssessmentSchema.parse({
      assessmentId: assessmentInsert.data.id,
      courseId: parsedInput.data.courseId,
      lessonId: lesson.id,
      type: parsedInput.data.type,
      questionCount: questionsInsert.data?.length ?? questionPayload.length,
      lessonTitle: lesson.title,
      objectiveCount: objectives.length,
      message: `${parsedInput.data.type[0]?.toUpperCase()}${parsedInput.data.type.slice(1)} generated for ${lesson.title}.`,
    }),
  };
}






