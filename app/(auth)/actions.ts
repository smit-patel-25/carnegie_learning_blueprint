"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

type MessageKind = "error" | "success";

function redirectWithMessage(
  pathname: string,
  kind: MessageKind,
  message: string,
): never {
  const params = new URLSearchParams({
    [kind]: message,
  });

  redirect(`${pathname}?${params.toString()}`);
}

async function getOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (!origin) {
    return "http://localhost:3000";
  }

  return origin;
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/login",
      "error",
      parsed.error.issues[0]?.message ?? "Enter a valid email and password.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirectWithMessage("/login", "error", error.message);
  }

  redirect("/dashboard");
}

export async function signInWithGoogleAction() {
  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/dashboard`,
    },
  });

  if (error) {
    redirectWithMessage("/login", "error", error.message);
  }

  if (!data.url) {
    redirectWithMessage("/login", "error", "Google SSO could not be started.");
  }

  redirect(data.url);
}

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/register",
      "error",
      parsed.error.issues[0]?.message ?? "Enter valid registration details.",
    );
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/dashboard`,
      data: {
        role: parsed.data.role,
      },
    },
  });

  if (error) {
    redirectWithMessage("/register", "error", error.message);
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirectWithMessage(
    "/login",
    "success",
    "Check your email to confirm your account before signing in.",
  );
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirectWithMessage(
      "/reset",
      "error",
      parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    );
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/login`,
  });

  if (error) {
    redirectWithMessage("/reset", "error", error.message);
  }

  redirectWithMessage(
    "/reset",
    "success",
    "If that account exists, a password reset email has been sent.",
  );
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?success=You%20have%20been%20signed%20out.");
}


