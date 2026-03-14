import { createClient } from "@supabase/supabase-js";

const roles = ["student", "teacher", "admin", "parent"];

function normalize(role) {
  return roles.includes(role) ? role : "student";
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const usersRes = await supabase.auth.admin.listUsers();
if (usersRes.error) {
  throw new Error(usersRes.error.message);
}

let profilesCreated = 0;
let studentsCreated = 0;
let teachersCreated = 0;

for (const user of usersRes.data.users) {
  const roleFromMetadata = normalize(user.user_metadata?.role);
  const profileRes = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle();

  if (profileRes.error) {
    throw new Error(`profile lookup failed for ${user.email}: ${profileRes.error.message}`);
  }

  if (!profileRes.data) {
    const insertProfile = await supabase.from("profiles").insert({
      id: user.id,
      role: roleFromMetadata,
    });

    if (insertProfile.error) {
      throw new Error(`profile insert failed for ${user.email}: ${insertProfile.error.message}`);
    }

    profilesCreated += 1;
  }

  const effectiveRole = profileRes.data?.role ?? roleFromMetadata;

  if (effectiveRole === "student") {
    const studentRes = await supabase.from("students").select("id").eq("user_id", user.id).limit(1);

    if (studentRes.error) {
      throw new Error(`student lookup failed for ${user.email}: ${studentRes.error.message}`);
    }

    if (!studentRes.data || studentRes.data.length === 0) {
      const insertStudent = await supabase.from("students").insert({ user_id: user.id });

      if (insertStudent.error) {
        throw new Error(`student insert failed for ${user.email}: ${insertStudent.error.message}`);
      }

      studentsCreated += 1;
    }
  }

  if (effectiveRole === "teacher") {
    const teacherRes = await supabase.from("teachers").select("id").eq("user_id", user.id).limit(1);

    if (teacherRes.error) {
      throw new Error(`teacher lookup failed for ${user.email}: ${teacherRes.error.message}`);
    }

    if (!teacherRes.data || teacherRes.data.length === 0) {
      const insertTeacher = await supabase.from("teachers").insert({ user_id: user.id });

      if (insertTeacher.error) {
        throw new Error(`teacher insert failed for ${user.email}: ${insertTeacher.error.message}`);
      }

      teachersCreated += 1;
    }
  }
}

console.log(
  JSON.stringify(
    {
      repaired: true,
      totalUsers: usersRes.data.users.length,
      profilesCreated,
      studentsCreated,
      teachersCreated,
    },
    null,
    2,
  ),
);

