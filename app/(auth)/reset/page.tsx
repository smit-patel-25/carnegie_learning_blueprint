import type { Metadata } from "next";

import Link from "next/link";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";

import { resetPasswordAction } from "../actions";

type AuthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Reset Password | Adaptive Learning Intelligence Platform",
  description: "Request a password reset email for your account.",
};

export default async function ResetPage({ searchParams }: AuthPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";

  return (
    <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">
          Password reset
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Recover access to your account.
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          We&apos;ll send a reset email if the address exists in the system.
        </p>
      </div>
      <form action={resetPasswordAction} className="mt-8 space-y-5">
        <FormMessage error={error} success={success} />
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="rounded-2xl border border-input bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-primary"
          />
        </label>
        <SubmitButton idleLabel="Send reset email" pendingLabel="Sending email..." />
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to login
        </Link>
      </p>
    </div>
  );
}
