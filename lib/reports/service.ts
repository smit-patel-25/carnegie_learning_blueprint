import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";

import {
  getCourseDetailsForViewer,
  getTeacherCourseAnalyticsForViewer,
} from "@/lib/learning/service";
import {
  gradebookReportSchema,
  type GradeModel,
  type GradebookReport,
  type GradebookReportQuery,
  type ReportScope,
} from "@/lib/validations/reporting";

type ViewerRole = "student" | "teacher" | "admin" | "parent";

type ViewerContext = {
  role: ViewerRole;
  userId: string;
  studentId: string | null;
};

type ServiceResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

type SubmissionRow = {
  student_id: string;
  score: number | null;
};

function roundMetric(value: number) {
  return Math.round(value);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

function toLetterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) {
    return "A";
  }

  if (score >= 80) {
    return "B";
  }

  if (score >= 70) {
    return "C";
  }

  if (score >= 60) {
    return "D";
  }

  return "F";
}

function calculateFinalGrade(input: {
  completionPercentage: number;
  masteryScore: number;
  assessmentAverage: number;
  gradeModel: GradeModel;
}) {
  const { completionPercentage, masteryScore, assessmentAverage, gradeModel } = input;

  if (gradeModel === "mastery") {
    return roundMetric(
      completionPercentage * 0.25 + masteryScore * 0.6 + assessmentAverage * 0.15,
    );
  }

  if (gradeModel === "completion") {
    return roundMetric(
      completionPercentage * 0.7 + masteryScore * 0.2 + assessmentAverage * 0.1,
    );
  }

  return roundMetric(
    completionPercentage * 0.4 + masteryScore * 0.4 + assessmentAverage * 0.2,
  );
}

function includeRowForScope(row: { needsAttention: boolean }, scope: ReportScope) {
  if (scope === "attention") {
    return row.needsAttention;
  }

  if (scope === "on-track") {
    return !row.needsAttention;
  }

  return true;
}

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

  const role = (profileResponse.data?.role ?? ensuredContext?.role ?? "student") as ViewerRole;

  if (role !== "student") {
    return {
      data: {
        role,
        userId: user.id,
        studentId: null,
      },
    };
  }

  const studentResponse = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (studentResponse.error) {
    return { error: "Your student record could not be loaded." };
  }

  return {
    data: {
      role,
      userId: user.id,
      studentId: studentResponse.data?.[0]?.id ?? null,
    },
  };
}

async function getAssessmentAverageByStudent(
  supabase: SupabaseClient,
  input: {
    lessonIds: string[];
    studentIds: string[];
  },
): Promise<ServiceResult<Map<string, number>>> {
  const { lessonIds, studentIds } = input;

  if (lessonIds.length === 0 || studentIds.length === 0) {
    return { data: new Map<string, number>() };
  }

  const assessmentResponse = await supabase
    .from("assessments")
    .select("id")
    .in("lesson_id", lessonIds);

  if (assessmentResponse.error) {
    return { error: "Assessment records could not be loaded for report generation." };
  }

  const assessmentIds = (assessmentResponse.data ?? []).map((row) => row.id);

  if (assessmentIds.length === 0) {
    return { data: new Map<string, number>() };
  }

  const submissionsResponse = await supabase
    .from("submissions")
    .select("student_id, score")
    .in("assessment_id", assessmentIds)
    .in("student_id", studentIds);

  if (submissionsResponse.error) {
    return { error: "Submission records could not be loaded for report generation." };
  }

  const scoreMap = new Map<string, number[]>();

  ((submissionsResponse.data ?? []) as SubmissionRow[]).forEach((row) => {
    if (typeof row.score !== "number") {
      return;
    }

    const scores = scoreMap.get(row.student_id) ?? [];
    scores.push(clampPercent(row.score));
    scoreMap.set(row.student_id, scores);
  });

  const averageMap = new Map<string, number>();

  studentIds.forEach((studentId) => {
    averageMap.set(studentId, roundMetric(average(scoreMap.get(studentId) ?? [])));
  });

  return { data: averageMap };
}

function buildSummary(reportRows: GradebookReport["rows"]) {
  const learnerCount = reportRows.length;

  return {
    learnerCount,
    classAverageGrade: learnerCount === 0 ? 0 : roundMetric(average(reportRows.map((row) => row.finalGrade))),
    classAverageCompletion:
      learnerCount === 0
        ? 0
        : roundMetric(average(reportRows.map((row) => row.completionPercentage))),
    classAverageMastery:
      learnerCount === 0 ? 0 : roundMetric(average(reportRows.map((row) => row.masteryScore))),
    learnersNeedingAttention: reportRows.filter((row) => row.needsAttention).length,
  };
}

export async function getGradebookReportForViewer(
  supabase: SupabaseClient,
  input: GradebookReportQuery,
): Promise<ServiceResult<GradebookReport | null>> {
  const viewerResult = await getViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your account context could not be resolved." };
  }

  if (viewer.role === "teacher" || viewer.role === "admin") {
    const analyticsResult = await getTeacherCourseAnalyticsForViewer(supabase, {
      courseId: input.courseId,
    });

    if (analyticsResult.error) {
      return analyticsResult;
    }

    if (!analyticsResult.data) {
      return { data: null };
    }

    const lessonIds = analyticsResult.data.lessons.map((lesson) => lesson.lessonId);
    const studentIds = analyticsResult.data.students.map((student) => student.studentId);
    const assessmentAverageResult = await getAssessmentAverageByStudent(supabase, {
      lessonIds,
      studentIds,
    });

    if (assessmentAverageResult.error) {
      return assessmentAverageResult;
    }

    const assessmentAverageByStudent = assessmentAverageResult.data;

    if (!assessmentAverageByStudent) {
      return { error: "Assessment signals could not be loaded." };
    }

    const rows = analyticsResult.data.students
      .map((student) => {
        const completionPercentage = clampPercent(student.completionPercentage);
        const masteryScore = clampPercent(student.masteryScore);
        const assessmentAverage = assessmentAverageByStudent.get(student.studentId) ?? 0;
        const needsAttention = completionPercentage < 50 || masteryScore < 60;
        const finalGrade = calculateFinalGrade({
          completionPercentage,
          masteryScore,
          assessmentAverage,
          gradeModel: input.gradeModel,
        });

        return {
          studentId: student.studentId,
          displayName: student.displayName,
          gradeLevel: student.gradeLevel,
          completionPercentage,
          masteryScore,
          assessmentAverage,
          finalGrade,
          letterGrade: toLetterGrade(finalGrade),
          needsAttention,
        };
      })
      .filter((row) => includeRowForScope(row, input.scope));

    return {
      data: gradebookReportSchema.parse({
        courseId: analyticsResult.data.courseId,
        courseTitle: analyticsResult.data.title,
        viewerRole: viewer.role,
        scope: input.scope,
        gradeModel: input.gradeModel,
        generatedAt: new Date().toISOString(),
        rows,
        summary: buildSummary(rows),
      }),
    };
  }

  if (viewer.role !== "student" || !viewer.studentId) {
    return { error: "Only students, teachers, or admins can access reports right now." };
  }

  const courseDetailResult = await getCourseDetailsForViewer(supabase, {
    courseId: input.courseId,
  });

  if (courseDetailResult.error) {
    return courseDetailResult;
  }

  if (!courseDetailResult.data) {
    return { data: null };
  }

  const courseDetail = courseDetailResult.data;
  const completionPercentage =
    courseDetail.lessons.length === 0
      ? 0
      : roundMetric(
          average(courseDetail.lessons.map((lesson) => clampPercent(lesson.completionPercentage))),
        );
  const masteryScore =
    courseDetail.lessons.length === 0
      ? 0
      : roundMetric(average(courseDetail.lessons.map((lesson) => clampPercent(lesson.masteryScore))));

  const assessmentAverageResult = await getAssessmentAverageByStudent(supabase, {
    lessonIds: courseDetail.lessons.map((lesson) => lesson.id),
    studentIds: [viewer.studentId],
  });

  if (assessmentAverageResult.error) {
    return assessmentAverageResult;
  }

  const assessmentAverage = assessmentAverageResult.data?.get(viewer.studentId) ?? 0;
  const needsAttention = completionPercentage < 50 || masteryScore < 60;
  const finalGrade = calculateFinalGrade({
    completionPercentage,
    masteryScore,
    assessmentAverage,
    gradeModel: input.gradeModel,
  });

  const rows = [
    {
      studentId: viewer.studentId,
      displayName: "You",
      gradeLevel: "Current",
      completionPercentage,
      masteryScore,
      assessmentAverage,
      finalGrade,
      letterGrade: toLetterGrade(finalGrade),
      needsAttention,
    },
  ].filter((row) => includeRowForScope(row, input.scope));

  return {
    data: gradebookReportSchema.parse({
      courseId: courseDetail.course.id,
      courseTitle: courseDetail.course.title,
      viewerRole: viewer.role,
      scope: input.scope,
      gradeModel: input.gradeModel,
      generatedAt: new Date().toISOString(),
      rows,
      summary: buildSummary(rows),
    }),
  };
}

function escapeCsv(value: string | number | boolean) {
  const text = String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toGradebookCsv(report: GradebookReport) {
  const headers = [
    "student_id",
    "display_name",
    "grade_level",
    "completion_percentage",
    "mastery_score",
    "assessment_average",
    "final_grade",
    "letter_grade",
    "needs_attention",
  ];

  const rows = report.rows.map((row) => [
    row.studentId,
    row.displayName,
    row.gradeLevel,
    row.completionPercentage,
    row.masteryScore,
    row.assessmentAverage,
    row.finalGrade,
    row.letterGrade,
    row.needsAttention,
  ]);

  return [headers, ...rows]
    .map((line) => line.map((value) => escapeCsv(value)).join(","))
    .join("\n");
}








