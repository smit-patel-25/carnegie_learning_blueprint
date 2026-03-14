import { generateAssessmentAction } from "@/app/(dashboard)/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type GenerateAssessmentFormProps = {
  courseId: string;
  lessonId: string;
};

export function GenerateAssessmentForm({ courseId, lessonId }: GenerateAssessmentFormProps) {
  return (
    <form action={generateAssessmentAction} className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
        <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Assessment type
          <select
            name="type"
            defaultValue="quiz"
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
          >
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="exam">Exam</option>
          </select>
        </label>
        <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Questions
          <input
            type="number"
            name="questionCount"
            min={1}
            max={8}
            defaultValue={3}
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
          />
        </label>
        <FormSubmitButton
          idleLabel="Generate assessment"
          pendingLabel="Generating..."
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        />
      </div>
    </form>
  );
}

