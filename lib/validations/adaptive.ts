import { z } from "zod";

const uuidField = z.string().uuid("Enter a valid identifier.");

export const adaptiveRecommendationQuerySchema = z.object({
  courseId: uuidField.optional(),
});

export const adaptiveRecommendationSchema = z.object({
  courseId: uuidField,
  courseTitle: z.string(),
  recommendedLessonId: uuidField,
  recommendedLessonTitle: z.string(),
  recommendedDifficulty: z.enum(["support", "core", "stretch"]),
  recommendedPacing: z.enum(["slow", "steady", "accelerate"]),
  confidenceScore: z.number().int().min(0).max(100),
  reason: z.string(),
  nextActionLabel: z.string(),
  metrics: z.object({
    completionPercentage: z.number().min(0).max(100),
    masteryScore: z.number().min(0).max(100),
    assessmentScore: z.number().min(0).max(100),
  }),
});

export type AdaptiveRecommendation = z.infer<typeof adaptiveRecommendationSchema>;
export type AdaptiveRecommendationQuery = z.infer<typeof adaptiveRecommendationQuerySchema>;
