"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function redirectWithMessage(message: string, kind: "success" | "error" = "success"): never {
  redirect(`/settings?${kind}=${encodeURIComponent(message)}`);
}

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("Please sign in to update profile.", "error");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  const updateResponse = await supabase
    .from("profiles")
    .update({
      full_name: fullName.length > 0 ? fullName : null,
      bio: bio.length > 0 ? bio : null,
    })
    .eq("id", user.id);

  if (updateResponse.error) {
    redirectWithMessage("Profile could not be updated.", "error");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirectWithMessage("Profile updated.");
}
