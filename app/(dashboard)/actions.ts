"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { generateAssessmentForViewer } from "@/lib/assessments/generator";
import { submitAssessmentForViewer } from "@/lib/assessments/service";
import { recordProgressForViewer } from "@/lib/learning/service";
import { createClient } from "@/lib/supabase/server";

export type SubmitAssessmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  score: number | null;
};

function redirectDashboardWith(courseId: string, kind: "success" | "error", message: string): never {
  redirect(
    `/dashboard?course=${encodeURIComponent(courseId)}&${kind}=${encodeURIComponent(message)}`,
  );
}

async function getViewerRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const profileResponse = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return profileResponse.data?.role ?? "student";
}

export async function recordProgressAction(formData: FormData) {
  const supabase = await createClient();
  const courseId = String(formData.get("courseId") ?? "");
  const result = await recordProgressForViewer(supabase, {
    courseId,
    lessonId: String(formData.get("lessonId") ?? ""),
    completionPercentage: Number(formData.get("completionPercentage") ?? 0),
    masteryScore: Number(formData.get("masteryScore") ?? 0),
  });

  if (result.error) {
    redirectDashboardWith(courseId, "error", result.error);
  }

  if (!result.data) {
    redirectDashboardWith(courseId, "error", "Progress could not be saved.");
  }

  revalidatePath("/dashboard");
  redirectDashboardWith(result.data.courseId, "success", result.data.message);
}

export async function generateAssessmentAction(formData: FormData) {
  const supabase = await createClient();
  const courseId = String(formData.get("courseId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const type = String(formData.get("type") ?? "quiz");
  const questionCount = Number(formData.get("questionCount") ?? 3);
  const result = await generateAssessmentForViewer(supabase, {
    courseId,
    lessonId,
    type: type === "assignment" || type === "exam" ? type : "quiz",
    questionCount,
  });

  if (result.error) {
    redirectDashboardWith(courseId, "error", result.error);
  }

  if (!result.data) {
    redirectDashboardWith(courseId, "error", "Assessment generation failed.");
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/courses/${result.data.courseId}/lessons/${result.data.lessonId}`);
  redirectDashboardWith(result.data.courseId, "success", result.data.message);
}

export async function assignStudentToCourseAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const courseId = String(formData.get("courseId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const currentLessonIdRaw = String(formData.get("currentLessonId") ?? "").trim();
  const currentLessonId = currentLessonIdRaw.length > 0 ? currentLessonIdRaw : null;

  if (!user) {
    redirectDashboardWith(courseId, "error", "You must be signed in to assign learners.");
  }

  const role = await getViewerRole(supabase, user.id);

  if (role !== "teacher" && role !== "admin") {
    redirectDashboardWith(courseId, "error", "Only teachers or admins can assign learners.");
  }

  if (!courseId || !studentId) {
    redirectDashboardWith(courseId, "error", "Select both a learner and course.");
  }

  const upsertResponse = await supabase.from("learning_paths").upsert(
    {
      student_id: studentId,
      course_id: courseId,
      current_lesson_id: currentLessonId,
    },
    {
      onConflict: "student_id,course_id",
    },
  );

  if (upsertResponse.error) {
    redirectDashboardWith(courseId, "error", "Assignment could not be saved.");
  }

  revalidatePath("/dashboard");
  redirectDashboardWith(courseId, "success", "Learner assignment updated.");
}

export async function linkParentToStudentAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const courseId = String(formData.get("courseId") ?? "");
  const parentUserId = String(formData.get("parentUserId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const relationship = String(formData.get("relationship") ?? "Guardian").trim() || "Guardian";

  if (!user) {
    redirectDashboardWith(courseId, "error", "You must be signed in to link parent accounts.");
  }

  const role = await getViewerRole(supabase, user.id);

  if (role !== "admin") {
    redirectDashboardWith(courseId, "error", "Only admins can link parent and student accounts.");
  }

  if (!parentUserId || !studentId) {
    redirectDashboardWith(courseId, "error", "Select both a parent and learner.");
  }

  const existingResponse = await supabase
    .from("parent_accounts")
    .select("id")
    .eq("user_id", parentUserId)
    .eq("student_id", studentId)
    .limit(1);

  if (existingResponse.error) {
    redirectDashboardWith(courseId, "error", "Parent linkage could not be checked.");
  }

  if ((existingResponse.data ?? []).length === 0) {
    const insertResponse = await supabase
      .from("parent_accounts")
      .insert({ user_id: parentUserId, student_id: studentId, relationship });

    if (insertResponse.error) {
      redirectDashboardWith(courseId, "error", "Parent linkage could not be saved.");
    }
  }

  revalidatePath("/dashboard");
  redirectDashboardWith(courseId, "success", "Parent-student relationship saved.");
}

export async function submitAssessmentAction(
  _previousState: SubmitAssessmentActionState,
  formData: FormData,
): Promise<SubmitAssessmentActionState> {
  const supabase = await createClient();
  const courseId = String(formData.get("courseId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const answers = Array.from(formData.entries())
    .filter(([key, value]) => key.startsWith("answer:") && typeof value === "string")
    .map(([key, value]) => ({
      questionId: key.replace("answer:", ""),
      answer: String(value ?? ""),
    }));

  const result = await submitAssessmentForViewer(supabase, {
    courseId,
    lessonId,
    assessmentId,
    answers,
  });

  if (result.error || !result.data) {
    return {
      status: "error",
      message: result.error ?? "Assessment submission failed.",
      score: null,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/courses/${result.data.courseId}/lessons/${result.data.lessonId}`);

  return {
    status: "success",
    message: result.data.message,
    score: result.data.score,
  };
}
