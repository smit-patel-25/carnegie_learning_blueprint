import { assignStudentToCourseAction } from "@/app/(dashboard)/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type StudentOption = {
  id: string;
  label: string;
};

type LessonOption = {
  id: string;
  title: string;
};

type AssignStudentFormProps = {
  courseId: string;
  students: StudentOption[];
  lessons: LessonOption[];
};

export function AssignStudentForm({ courseId, students, lessons }: AssignStudentFormProps) {
  return (
    <form action={assignStudentToCourseAction} className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Learner
          <select
            name="studentId"
            required
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
            defaultValue=""
          >
            <option value="" disabled>
              Select learner
            </option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Start lesson (optional)
          <select
            name="currentLessonId"
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
            defaultValue=""
          >
            <option value="">Use default sequence</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FormSubmitButton
        idleLabel="Assign learner"
        pendingLabel="Assigning learner..."
        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      />
    </form>
  );
}

