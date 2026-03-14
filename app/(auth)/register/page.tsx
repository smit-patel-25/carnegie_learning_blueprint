import type { Metadata } from "next";

import Link from "next/link";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";

import { registerAction } from "../actions";

type AuthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Register | Adaptive Learning Intelligence Platform",
  description: "Create a new account for the adaptive learning platform.",
};

export default async function RegisterPage({ searchParams }: AuthPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";

  return (
    <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">
          Register
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Create your learning account.
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Choose your learning role during registration. Admin roles are managed separately.
        </p>
      </div>
      <form action={registerAction} className="mt-8 space-y-5">
        <FormMessage error={error} />
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Role
          <select
            name="role"
            defaultValue="student"
            required
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-primary"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="parent">Parent / Guardian</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-primary"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Confirm password
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            className="relative z-10 w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-primary"
          />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          Student, teacher, and parent selections are onboarding intent only; admin remains controlled separately.
        </p>
        <SubmitButton idleLabel="Create account" pendingLabel="Creating account..." />
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Already registered?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}


