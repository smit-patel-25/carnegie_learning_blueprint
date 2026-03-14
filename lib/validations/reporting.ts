import { z } from "zod";

const uuidField = z.string().uuid("Enter a valid identifier.");

export const reportScopeSchema = z.enum(["full", "attention", "on-track"]);
export const gradeModelSchema = z.enum(["balanced", "mastery", "completion"]);
export const reportFormatSchema = z.enum(["json", "csv"]);

export const gradebookReportQuerySchema = z.object({
  courseId: uuidField,
  scope: reportScopeSchema.default("full"),
  gradeModel: gradeModelSchema.default("balanced"),
  format: reportFormatSchema.default("json"),
});

export const gradebookRowSchema = z.object({
  studentId: uuidField,
  displayName: z.string(),
  gradeLevel: z.string(),
  completionPercentage: z.number().min(0).max(100),
  masteryScore: z.number().min(0).max(100),
  assessmentAverage: z.number().min(0).max(100),
  finalGrade: z.number().min(0).max(100),
  letterGrade: z.enum(["A", "B", "C", "D", "F"]),
  needsAttention: z.boolean(),
});

export const gradebookSummarySchema = z.object({
  learnerCount: z.number().int().nonnegative(),
  classAverageGrade: z.number().min(0).max(100),
  classAverageCompletion: z.number().min(0).max(100),
  classAverageMastery: z.number().min(0).max(100),
  learnersNeedingAttention: z.number().int().nonnegative(),
});

export const gradebookReportSchema = z.object({
  courseId: uuidField,
  courseTitle: z.string(),
  viewerRole: z.enum(["student", "teacher", "admin", "parent"]),
  scope: reportScopeSchema,
  gradeModel: gradeModelSchema,
  generatedAt: z.string(),
  rows: z.array(gradebookRowSchema),
  summary: gradebookSummarySchema,
});

export type ReportScope = z.infer<typeof reportScopeSchema>;
export type GradeModel = z.infer<typeof gradeModelSchema>;
export type ReportFormat = z.infer<typeof reportFormatSchema>;
export type GradebookReportQuery = z.infer<typeof gradebookReportQuerySchema>;
export type GradebookReport = z.infer<typeof gradebookReportSchema>;
