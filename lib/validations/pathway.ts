import { z } from "zod";

const uuidField = z.string().uuid("Enter a valid identifier.");

export const objectiveMapSchema = z.object({
  id: uuidField,
  lessonId: uuidField,
  objective: z.string(),
  competency: z.string().nullable(),
  standardCode: z.string().nullable(),
  standardDescription: z.string().nullable(),
});

export const lessonPathwaySchema = z.object({
  courseId: uuidField,
  lessonId: uuidField,
  currentLessonId: uuidField.nullable(),
  activePosition: z.number().int().positive(),
  totalLessons: z.number().int().positive(),
  progressState: z.enum(["not-started", "current-focus", "ready-to-advance"]),
  assessmentCount: z.number().int().nonnegative(),
  objectives: z.array(objectiveMapSchema),
});

export type ObjectiveMap = z.infer<typeof objectiveMapSchema>;
export type LessonPathway = z.infer<typeof lessonPathwaySchema>;
