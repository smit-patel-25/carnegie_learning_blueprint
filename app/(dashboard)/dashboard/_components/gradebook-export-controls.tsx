"use client";

import { useMemo, useState } from "react";

import type { GradeModel, ReportScope } from "@/lib/validations/reporting";

type GradebookExportControlsProps = {
  courseId: string;
};

function buildReportUrl(input: {
  courseId: string;
  scope: ReportScope;
  gradeModel: GradeModel;
  format: "json" | "csv";
}) {
  const params = new URLSearchParams({
    courseId: input.courseId,
    scope: input.scope,
    gradeModel: input.gradeModel,
    format: input.format,
  });

  return `/api/reports/gradebook?${params.toString()}`;
}

export function GradebookExportControls({ courseId }: GradebookExportControlsProps) {
  const [scope, setScope] = useState<ReportScope>("full");
  const [gradeModel, setGradeModel] = useState<GradeModel>("balanced");

  const csvUrl = useMemo(() => {
    return buildReportUrl({
      courseId,
      scope,
      gradeModel,
      format: "csv",
    });
  }, [courseId, scope, gradeModel]);

  const jsonUrl = useMemo(() => {
    return buildReportUrl({
      courseId,
      scope,
      gradeModel,
      format: "json",
    });
  }, [courseId, scope, gradeModel]);

  return (
    <section className="rounded-[1.4rem] border border-border bg-muted/30 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Reporting controls
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            Gradebook export
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Configure scope and grading model, then download CSV or open structured JSON.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Scope
          </span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as ReportScope)}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="full">Full class</option>
            <option value="attention">Needs attention</option>
            <option value="on-track">On track</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Grade model
          </span>
          <select
            value={gradeModel}
            onChange={(event) => setGradeModel(event.target.value as GradeModel)}
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="balanced">Balanced</option>
            <option value="mastery">Mastery-weighted</option>
            <option value="completion">Completion-weighted</option>
          </select>
        </label>
        <a
          href={jsonUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
        >
          Open JSON
        </a>
        <a
          href={csvUrl}
          className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Download CSV
        </a>
      </div>
    </section>
  );
}

