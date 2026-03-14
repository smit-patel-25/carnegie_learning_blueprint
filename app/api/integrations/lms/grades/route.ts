import { NextResponse } from "next/server";

import { getGradebookReportForViewer, toGradebookCsv } from "@/lib/reports/service";
import { createClient } from "@/lib/supabase/server";
import { gradebookReportQuerySchema } from "@/lib/validations/reporting";

function getErrorStatus(message: string) {
  if (message.includes("signed in") || message.includes("Only ")) {
    return 403;
  }

  return 400;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedQuery = gradebookReportQuerySchema.safeParse({
    courseId: url.searchParams.get("courseId"),
    scope: url.searchParams.get("scope") ?? undefined,
    gradeModel: url.searchParams.get("gradeModel") ?? undefined,
    format: url.searchParams.get("format") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: parsedQuery.error.issues[0]?.message ?? "Invalid grade exchange query." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const result = await getGradebookReportForViewer(supabase, parsedQuery.data);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: getErrorStatus(result.error) });
  }

  if (!result.data) {
    return NextResponse.json({ error: "Grade exchange payload could not be built." }, { status: 404 });
  }

  if (parsedQuery.data.format === "csv") {
    const csvBody = toGradebookCsv(result.data);

    return new Response(csvBody, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lms-grades-${parsedQuery.data.courseId.slice(0, 8)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    data: {
      provider: "google-workspace",
      generatedAt: result.data.generatedAt,
      course: {
        id: result.data.courseId,
        title: result.data.courseTitle,
      },
      gradeModel: result.data.gradeModel,
      scope: result.data.scope,
      summary: result.data.summary,
      grades: result.data.rows.map((row) => ({
        learnerId: row.studentId,
        learnerName: row.displayName,
        gradeLevel: row.gradeLevel,
        finalGrade: row.finalGrade,
        letterGrade: row.letterGrade,
        completionPercentage: row.completionPercentage,
        masteryScore: row.masteryScore,
        assessmentAverage: row.assessmentAverage,
        needsAttention: row.needsAttention,
      })),
    },
  });
}
