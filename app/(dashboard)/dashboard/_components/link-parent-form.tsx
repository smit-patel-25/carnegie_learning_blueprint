import { linkParentToStudentAction } from "@/app/(dashboard)/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type ParentOption = {
  id: string;
  label: string;
};

type StudentOption = {
  id: string;
  label: string;
};

type LinkParentFormProps = {
  courseId: string;
  parents: ParentOption[];
  students: StudentOption[];
};

export function LinkParentForm({ courseId, parents, students }: LinkParentFormProps) {
  return (
    <form action={linkParentToStudentAction} className="grid gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Parent account
          <select
            name="parentUserId"
            required
            defaultValue=""
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
          >
            <option value="" disabled>
              Select parent
            </option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Learner
          <select
            name="studentId"
            required
            defaultValue=""
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
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
      </div>
      <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Relationship
        <input
          type="text"
          name="relationship"
          defaultValue="Guardian"
          className="rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-primary"
        />
      </label>
      <FormSubmitButton
        idleLabel="Link parent"
        pendingLabel="Linking parent..."
        className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      />
    </form>
  );
}

