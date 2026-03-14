import { recordProgressAction } from "@/app/(dashboard)/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type CourseProgressFormProps = {
  courseId: string;
  lessonId: string;
  completionPercentage: number;
  masteryScore: number;
};

export function CourseProgressForm({
  courseId,
  lessonId,
  completionPercentage,
  masteryScore,
}: CourseProgressFormProps) {
  return (
    <form action={recordProgressAction} className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Completion
          <input
            type="number"
            name="completionPercentage"
            min={0}
            max={100}
            defaultValue={completionPercentage}
            className="rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Mastery
          <input
            type="number"
            name="masteryScore"
            min={0}
            max={100}
            defaultValue={masteryScore}
            className="rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
          />
        </label>
      </div>
      <FormSubmitButton
        idleLabel="Save lesson progress"
        pendingLabel="Saving progress..."
        className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5"
      />
    </form>
  );
}
