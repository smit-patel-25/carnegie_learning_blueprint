import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/auth/submit-button";
import { createClient } from "@/lib/supabase/server";

import { updateProfileAction } from "./actions";
import { AvatarUploader } from "./_components/avatar-uploader";

export const metadata: Metadata = {
  title: "Settings | Adaptive Learning Intelligence Platform",
  description: "Manage your profile and account preferences.",
};

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : "";
  const error = typeof params.error === "string" ? params.error : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileResponse = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url, bio")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileResponse.data;

  return (
    <main className="container py-10 md:py-16">
      <section className="mx-auto max-w-5xl space-y-6 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(31,41,55,0.12)] backdrop-blur md:p-8">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/70">Settings</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Profile and account preferences
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">
            Update your profile details, avatar, and role-facing workspace identity.
          </p>
        </div>

        {success ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
        ) : null}
        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <form action={updateProfileAction} className="space-y-4 rounded-[1.5rem] border border-border bg-background/60 p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Basic information</p>
              <p className="text-xs text-muted-foreground">Your profile appears across dashboard and reports.</p>
            </div>

            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Email
              <input
                type="text"
                readOnly
                value={user.email ?? ""}
                className="w-full rounded-2xl border border-input bg-muted px-4 py-3 text-sm font-medium normal-case tracking-normal text-muted-foreground"
              />
            </label>

            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Role
              <input
                type="text"
                readOnly
                value={profile?.role ?? "student"}
                className="w-full rounded-2xl border border-input bg-muted px-4 py-3 text-sm font-medium normal-case tracking-normal text-muted-foreground"
              />
            </label>

            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Full name
              <input
                type="text"
                name="fullName"
                defaultValue={profile?.full_name ?? ""}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-primary"
              />
            </label>

            <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Bio
              <textarea
                name="bio"
                rows={4}
                defaultValue={profile?.bio ?? ""}
                className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-primary"
              />
            </label>

            <SubmitButton idleLabel="Save profile" pendingLabel="Saving profile..." />
          </form>

          <AvatarUploader userId={user.id} currentAvatarUrl={profile?.avatar_url ?? null} />
        </div>
      </section>
    </main>
  );
}
