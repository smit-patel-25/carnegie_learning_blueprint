import { NextResponse } from "next/server";

import { getCourseDetailsForViewer } from "@/lib/learning/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const params = await context.params;
  const supabase = await createClient();
  const result = await getCourseDetailsForViewer(supabase, {
    courseId: params.courseId,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (!result.data) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  return NextResponse.json({ data: result.data });
}
