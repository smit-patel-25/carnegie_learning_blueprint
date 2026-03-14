"use client";

import { useActionState, useState } from "react";

import {
  submitAssessmentAction,
  type SubmitAssessmentActionState,
} from "@/app/(dashboard)/actions";
import type { LessonAssessment } from "@/lib/validations/assessment";

const initialState: SubmitAssessmentActionState = {
  status: "idle",
  message: "",
  score: null,
};

type AssessmentPanelProps = {
  courseId: string;
  lessonId: string;
  assessment: LessonAssessment;
};

export function AssessmentPanel({ courseId, lessonId, assessment }: AssessmentPanelProps) {
  const [actionState, formAction, isPending] = useActionState(
    submitAssessmentAction,
    initialState,
  );
  const [openHints, setOpenHints] = useState<Record<string, boolean>>({});

  return (
    <section className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">
            Assessment checkpoint
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Confirm understanding with a focused checkpoint.
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            Answer each prompt in your own words, then request a hint when you need a guided nudge.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-2">{assessment.type}</span>
          <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">
            {assessment.questionCount} questions
          </span>
          {assessment.score !== null ? (
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">
              Latest score {assessment.score}%
            </span>
          ) : null}
        </div>
      </div>

      {actionState.status !== "idle" ? (
        <div
          className={`mt-6 rounded-[1.4rem] px-4 py-3 text-sm leading-6 ${
            actionState.status === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {actionState.message}
          {actionState.status === "success" && actionState.score !== null ? ` Score: ${actionState.score}%.` : ""}
        </div>
      ) : null}

      <form action={formAction} className="mt-6 space-y-5">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="assessmentId" value={assessment.assessmentId} />

        {assessment.questions.map((question, index) => {
          const isHintOpen = openHints[question.id] ?? false;

          return (
            <article
              key={question.id}
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {question.difficulty}
                    </span>
                  </div>
                  <p className="text-sm leading-7 text-slate-800 md:text-base">
                    {question.questionText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOpenHints((current) => ({
                      ...current,
                      [question.id]: !current[question.id],
                    }))
                  }
                  className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                >
                  {isHintOpen ? "Hide hint" : "Need a hint?"}
                </button>
              </div>

              {isHintOpen ? (
                <div className="mt-4 rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  {question.hint}
                </div>
              ) : null}

              <label className="mt-4 grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Your response
                <textarea
                  name={`answer:${question.id}`}
                  rows={4}
                  required
                  className="min-h-28 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="Explain your thinking clearly."
                />
              </label>
            </article>
          );
        })}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm leading-6 text-slate-600">
            Your score updates the lesson signals used for next-step guidance.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Submitting..." : assessment.alreadySubmitted ? "Submit updated attempt" : "Submit assessment"}
          </button>
        </div>
      </form>
    </section>
  );
}
