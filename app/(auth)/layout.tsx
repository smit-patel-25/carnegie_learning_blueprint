import type { ReactNode } from "react";

import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-hero-grid bg-[size:52px_52px] opacity-40" />
      <div className="container flex min-h-screen items-center py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section className="space-y-8 rounded-[2rem] border border-white/60 bg-slate-900 p-8 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="space-y-4">
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-300">
                Welcome back
              </p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">
                Keep learning in motion from the moment you sign in.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-300">
                Move from access to action quickly, whether you are learning,
                guiding a class, or checking the next step forward.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-400">
                  For students
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Return to lessons, see progress clearly, and stay focused on
                  mastery.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-400">
                  For educators
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Track momentum, identify support needs, and guide each learner
                  with confidence.
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex text-sm font-medium text-slate-200 underline-offset-4 transition hover:text-white hover:underline"
            >
              Back to overview
            </Link>
          </section>
          <section>{children}</section>
        </div>
      </div>
    </main>
  );
}

