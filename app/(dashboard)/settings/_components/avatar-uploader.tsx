"use client";

import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type AvatarUploaderProps = {
  userId: string;
  currentAvatarUrl: string | null;
};

export function AvatarUploader({ userId, currentAvatarUrl }: AvatarUploaderProps) {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-border bg-background/60 p-5">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Profile avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Profile image</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP up to 5 MB.</p>
        </div>
      </div>

      <label className="grid gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Upload avatar
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="w-full rounded-2xl border border-input bg-white px-4 py-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-primary"
          onChange={async (event) => {
            const file = event.target.files?.[0];

            if (!file) {
              return;
            }

            if (file.size > 5 * 1024 * 1024) {
              setStatus("error");
              setMessage("Image size exceeds 5 MB.");
              return;
            }

            setStatus("uploading");
            setMessage("Uploading image...");

            const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
            const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

            const uploadResponse = await supabase.storage.from("avatars").upload(path, file, {
              upsert: false,
            });

            if (uploadResponse.error) {
              setStatus("error");
              setMessage("Avatar upload failed.");
              return;
            }

            const publicUrlResponse = supabase.storage.from("avatars").getPublicUrl(path);
            const avatarUrl = publicUrlResponse.data.publicUrl;

            const profileUpdate = await supabase
              .from("profiles")
              .update({ avatar_url: avatarUrl })
              .eq("id", userId);

            if (profileUpdate.error) {
              setStatus("error");
              setMessage("Image uploaded but profile update failed.");
              return;
            }

            setPreviewUrl(avatarUrl);
            setStatus("success");
            setMessage("Avatar updated.");
          }}
        />
      </label>

      {status !== "idle" ? (
        <p
          className={`rounded-2xl px-3 py-2 text-sm ${
            status === "error"
              ? "border border-red-200 bg-red-50 text-red-700"
              : status === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-sky-200 bg-sky-50 text-sky-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
