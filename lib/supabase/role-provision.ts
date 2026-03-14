import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const viewerRoles = ["student", "teacher", "admin", "parent"] as const;

type ViewerRole = (typeof viewerRoles)[number];

function normalizeRole(input: unknown): ViewerRole {
  if (typeof input !== "string") {
    return "student";
  }

  if (viewerRoles.includes(input as ViewerRole)) {
    return input as ViewerRole;
  }

  return "student";
}

function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function ensureRoleRecord(input: {
  role: ViewerRole;
  userId: string;
}) {
  const adminClient = createServiceRoleClient();

  if (!adminClient) {
    return;
  }

  if (input.role === "student") {
    const studentResponse = await adminClient
      .from("students")
      .select("id")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (!studentResponse.error && !studentResponse.data) {
      await adminClient.from("students").insert({ user_id: input.userId });
    }

    return;
  }

  if (input.role === "teacher") {
    const teacherResponse = await adminClient
      .from("teachers")
      .select("id")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (!teacherResponse.error && !teacherResponse.data) {
      await adminClient.from("teachers").insert({ user_id: input.userId });
    }
  }
}

export async function ensureViewerRoleRecordsForUser(input: {
  userId: string;
  metadataRole: unknown;
}): Promise<{ role: ViewerRole } | null> {
  const adminClient = createServiceRoleClient();
  const fallbackRole = normalizeRole(input.metadataRole);

  if (!adminClient) {
    return { role: fallbackRole };
  }

  const profileResponse = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", input.userId)
    .maybeSingle();

  let role = fallbackRole;

  if (profileResponse.error) {
    role = fallbackRole;
  } else if (!profileResponse.data) {
    const insertRole = fallbackRole;
    await adminClient.from("profiles").insert({ id: input.userId, role: insertRole });
    role = insertRole;
  } else {
    role = normalizeRole(profileResponse.data.role);
  }

  await ensureRoleRecord({ role, userId: input.userId });

  return { role };
}

