import type { Metadata } from "next";

import Link from "next/link";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";

import { loginAction, signInWithGoogleAction } from "../actions";

type AuthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Login | Adaptive Learning Intelligence Platform",
  description: "Sign in to access student and teacher experiences.",
};

export default async function LoginPage({ searchParams }: AuthPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : "";
  const success = typeof params.success === "string" ? params.success : "";

  return (
    <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">
          Login
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          Continue into your workspace.
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Sign in to return to your learning journey and pick up where you left
          off.
        </p>
      </div>
      <div className="mt-8 space-y-4">
        <form action={signInWithGoogleAction}>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Continue with Google SSO
          </button>
        </form>
        <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          or sign in with email
        </p>
      </div>
      <form action={loginAction} className="mt-5 space-y-5">
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
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="rounded-2xl border border-input bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-primary"
          />
        </label>
        <SubmitButton idleLabel="Sign in" pendingLabel="Signing in..." />
      </form>
      <div className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/reset"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Forgot your password?
        </Link>
        <span>
          Need an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </span>
      </div>
    </div>
  );
}

