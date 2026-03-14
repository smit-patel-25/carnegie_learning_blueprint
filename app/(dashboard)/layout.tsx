import type { ReactNode } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ensuredContext = await ensureViewerRoleRecordsForUser({
    userId: user.id,
    metadataRole: user.user_metadata?.role,
  });
  const role = ensuredContext?.role ?? "student";
  const roleLabel = `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  const showLibraryLink = role !== "parent";
  const showParentLink = role === "parent";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_48%,#ffffff_100%)]">
      <div className="absolute inset-0 -z-10 bg-hero-grid bg-[size:56px_56px] opacity-30" />
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="container grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-center">
          <div className="space-y-4">
            <div className="space-y-2">
              <Link
                href="/"
                className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500 transition hover:text-slate-900"
              >
                Adaptive learning workspace
              </Link>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                  Focused learning, clear next steps.
                </p>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  {roleLabel}
                </span>
              </div>
            </div>
            <DashboardNav showLibraryLink={showLibraryLink} showParentLink={showParentLink} />
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <p className="max-w-md text-sm leading-6 text-slate-600 lg:text-right">
              Move from overview to action quickly with one protected workspace for lessons,
              progress, analytics, and the next priority for each learner.
            </p>
            <form action={signOutAction}>
              <SignOutButton />
            </form>
          </div>
        </div>
      </header>
      <div id="main-content">{children}</div>
    </div>
  );
}
