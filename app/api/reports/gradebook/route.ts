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
      { error: parsedQuery.error.issues[0]?.message ?? "Invalid report query." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const result = await getGradebookReportForViewer(supabase, parsedQuery.data);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: getErrorStatus(result.error) });
  }

  if (!result.data) {
    return NextResponse.json({ error: "Report data could not be found." }, { status: 404 });
  }

  if (parsedQuery.data.format === "csv") {
    const csvBody = toGradebookCsv(result.data);

    return new Response(csvBody, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gradebook-${parsedQuery.data.courseId.slice(0, 8)}.csv"`,
      },
    });
  }

  return NextResponse.json({ data: result.data });
}
