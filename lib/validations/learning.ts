import { z } from "zod";

const uuidField = z.string().uuid("Enter a valid identifier.");
const nullableText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const nullableNumber = z
  .number()
  .nullish()
  .transform((value) => value ?? null);

export const courseSchema = z.object({
  id: uuidField,
  title: z.string().min(1),
  description: nullableText,
  teacher_id: uuidField,
  curriculum_id: z
    .string()
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  created_at: z.string(),
});

export const lessonSchema = z.object({
  id: uuidField,
  course_id: uuidField,
  title: z.string().min(1),
  content: nullableText,
  difficulty_level: nullableText,
  created_at: z.string(),
});

export const progressSchema = z.object({
  id: uuidField.optional(),
  student_id: uuidField,
  lesson_id: uuidField,
  completion_percentage: nullableNumber,
  mastery_score: nullableNumber,
  last_accessed: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
});

export const submissionSchema = z.object({
  id: uuidField,
  student_id: uuidField,
  assessment_id: uuidField,
  score: nullableNumber,
  submitted_at: z.string(),
});

export const learningPathSchema = z.object({
  student_id: uuidField,
  course_id: uuidField,
  current_lesson_id: z
    .string()
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
});

export const courseIdInputSchema = z.object({
  courseId: uuidField,
});

export const recordProgressInputSchema = z.object({
  courseId: uuidField,
  lessonId: uuidField,
  completionPercentage: z.coerce.number().min(0).max(100),
  masteryScore: z.coerce.number().min(0).max(100),
});

export const courseSummarySchema = z.object({
  id: uuidField,
  title: z.string(),
  description: z.string(),
  lessonCount: z.number().int().nonnegative(),
  completionPercentage: z.number().min(0).max(100),
  currentLessonId: z.string().uuid().nullable(),
});

export const courseDetailSchema = z.object({
  course: z.object({
    id: uuidField,
    title: z.string(),
    description: z.string(),
  }),
  lessons: z.array(
    z.object({
      id: uuidField,
      title: z.string(),
      content: z.string(),
      difficultyLevel: z.string(),
      completionPercentage: z.number().min(0).max(100),
      masteryScore: z.number().min(0).max(100),
      lastAccessed: z.string().nullable(),
    }),
  ),
  canRecordProgress: z.boolean(),
  viewerRole: z.enum(["student", "teacher", "admin", "parent"]),
});

export const teacherStudentAnalyticsSchema = z.object({
  studentId: uuidField,
  displayName: z.string(),
  gradeLevel: z.string(),
  completionPercentage: z.number().min(0).max(100),
  masteryScore: z.number().min(0).max(100),
  completedLessons: z.number().int().nonnegative(),
  activeLessons: z.number().int().nonnegative(),
});

export const teacherLessonAnalyticsSchema = z.object({
  lessonId: uuidField,
  title: z.string(),
  difficultyLevel: z.string(),
  averageCompletionPercentage: z.number().min(0).max(100),
  averageMasteryScore: z.number().min(0).max(100),
});

export const teacherCourseAnalyticsSchema = z.object({
  courseId: uuidField,
  title: z.string(),
  totalStudents: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  averageCompletionPercentage: z.number().min(0).max(100),
  averageMasteryScore: z.number().min(0).max(100),
  studentsNeedingAttention: z.number().int().nonnegative(),
  students: z.array(teacherStudentAnalyticsSchema),
  lessons: z.array(teacherLessonAnalyticsSchema),
});

export type Course = z.infer<typeof courseSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type ProgressRecord = z.infer<typeof progressSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export type LearningPath = z.infer<typeof learningPathSchema>;
export type CourseSummary = z.infer<typeof courseSummarySchema>;
export type CourseDetail = z.infer<typeof courseDetailSchema>;
export type RecordProgressInput = z.infer<typeof recordProgressInputSchema>;
export type TeacherCourseAnalytics = z.infer<typeof teacherCourseAnalyticsSchema>;
