import { NextResponse } from "next/server";

import { listCoursesForViewer } from "@/lib/learning/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const result = await listCoursesForViewer(supabase);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: result.data });
}
