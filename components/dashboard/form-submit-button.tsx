"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  className: string;
};

export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  className,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-disabled={pending}
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
