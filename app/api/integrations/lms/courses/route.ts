import { NextResponse } from "next/server";

import { listCoursesForViewer } from "@/lib/learning/service";
import { createClient } from "@/lib/supabase/server";

function getErrorStatus(message: string) {
  if (message.includes("signed in")) {
    return 403;
  }

  return 400;
}

export async function GET() {
  const supabase = await createClient();
  const result = await listCoursesForViewer(supabase);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: getErrorStatus(result.error) });
  }

  return NextResponse.json({
    data: {
      provider: "google-workspace",
      generatedAt: new Date().toISOString(),
      courses: (result.data ?? []).map((course) => ({
        localCourseId: course.id,
        title: course.title,
        lessonCount: course.lessonCount,
        completionPercentage: course.completionPercentage,
        currentLessonId: course.currentLessonId,
      })),
    },
  });
}
