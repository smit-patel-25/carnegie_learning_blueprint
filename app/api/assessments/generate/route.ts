import { NextResponse } from "next/server";

import { generateAssessmentForViewer } from "@/lib/assessments/generator";
import { createClient } from "@/lib/supabase/server";
import { assessmentGenerationInputSchema } from "@/lib/validations/assessment";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsedPayload = assessmentGenerationInputSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: parsedPayload.error.issues[0]?.message ?? "Invalid assessment request." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const result = await generateAssessmentForViewer(supabase, parsedPayload.data);

  if (result.error) {
    const status = result.error === "Only teachers or admins can generate assessments." ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
