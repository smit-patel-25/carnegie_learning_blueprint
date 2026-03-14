type FormMessageProps = {
  error?: string;
  success?: string;
};

export function FormMessage({ error, success }: FormMessageProps) {
  if (!error && !success) {
    return null;
  }

  if (error) {
    return (
      <p
        role="alert"
        aria-live="assertive"
        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {error}
      </p>
    );
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
    >
      {success}
    </p>
  );
}
