import { NextResponse } from "next/server";

import { getAdaptiveRecommendationsForViewer } from "@/lib/adaptive/engine";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId") ?? undefined;
  const supabase = await createClient();
  const result = await getAdaptiveRecommendationsForViewer(supabase, { courseId });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: result.data });
}
