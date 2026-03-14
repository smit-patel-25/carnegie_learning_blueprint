import { z } from "zod";

const uuidField = z.string().uuid("Enter a valid identifier.");
const nullableText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const assessmentTypeSchema = z.enum(["quiz", "assignment", "exam"]);

export const assessmentGenerationInputSchema = z.object({
  courseId: uuidField,
  lessonId: uuidField,
  type: assessmentTypeSchema,
  questionCount: z.coerce.number().int().min(1).max(8),
});

export const generatedAssessmentSchema = z.object({
  assessmentId: uuidField,
  courseId: uuidField,
  lessonId: uuidField,
  type: assessmentTypeSchema,
  questionCount: z.number().int().nonnegative(),
  lessonTitle: z.string(),
  objectiveCount: z.number().int().nonnegative(),
  message: z.string(),
});

export const lessonAssessmentQuestionSchema = z.object({
  id: uuidField,
  questionText: z.string(),
  difficulty: z.string(),
  explanation: nullableText,
  hint: z.string(),
});

export const lessonAssessmentSchema = z.object({
  assessmentId: uuidField,
  lessonId: uuidField,
  type: assessmentTypeSchema,
  createdAt: z.string(),
  questionCount: z.number().int().nonnegative(),
  alreadySubmitted: z.boolean(),
  score: z.number().min(0).max(100).nullable(),
  questions: z.array(lessonAssessmentQuestionSchema),
});

export const lessonAssessmentExperienceSchema = z.object({
  courseId: uuidField,
  lessonId: uuidField,
  viewerRole: z.enum(["student", "teacher", "admin", "parent"]),
  activeAssessment: lessonAssessmentSchema.nullable(),
});

export const assessmentAnswerInputSchema = z.object({
  questionId: uuidField,
  answer: z.string().trim().min(1, "Answer every question before submitting.").max(1000),
});

export const assessmentSubmissionInputSchema = z.object({
  courseId: uuidField,
  lessonId: uuidField,
  assessmentId: uuidField,
  answers: z.array(assessmentAnswerInputSchema).min(1, "At least one answer is required."),
});

export const assessmentSubmissionResultSchema = z.object({
  assessmentId: uuidField,
  courseId: uuidField,
  lessonId: uuidField,
  score: z.number().min(0).max(100),
  answeredQuestions: z.number().int().nonnegative(),
  message: z.string(),
});

export type AssessmentGenerationInput = z.infer<typeof assessmentGenerationInputSchema>;
export type GeneratedAssessment = z.infer<typeof generatedAssessmentSchema>;
export type LessonAssessment = z.infer<typeof lessonAssessmentSchema>;
export type LessonAssessmentExperience = z.infer<typeof lessonAssessmentExperienceSchema>;
export type AssessmentSubmissionInput = z.infer<typeof assessmentSubmissionInputSchema>;
export type AssessmentSubmissionResult = z.infer<typeof assessmentSubmissionResultSchema>;
