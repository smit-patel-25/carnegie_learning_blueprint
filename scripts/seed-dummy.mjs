import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function ensureUser(supabase, input) {
  const { email, password, role } = input;

  const listResponse = await supabase.auth.admin.listUsers();
  if (listResponse.error) {
    throw new Error(`Unable to list auth users: ${listResponse.error.message}`);
  }

  const existing = listResponse.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    const updateResponse = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { role },
    });

    if (updateResponse.error) {
      throw new Error(`Unable to update user ${email}: ${updateResponse.error.message}`);
    }

    return updateResponse.data.user;
  }

  const createResponse = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });

  if (createResponse.error || !createResponse.data.user) {
    throw new Error(`Unable to create user ${email}: ${createResponse.error?.message ?? "Unknown error"}`);
  }

  return createResponse.data.user;
}

async function ensureInstitution(supabase) {
  const existing = await supabase
    .from("institutions")
    .select("id")
    .eq("name", "Demo STEM Academy")
    .maybeSingle();

  if (!existing.error && existing.data) {
    return existing.data.id;
  }

  const insert = await supabase
    .from("institutions")
    .insert({ name: "Demo STEM Academy", location: "Austin, TX" })
    .select("id")
    .maybeSingle();

  if (insert.error || !insert.data) {
    throw new Error(`Unable to ensure institution: ${insert.error?.message ?? "Unknown error"}`);
  }

  return insert.data.id;
}

async function ensureTeacher(supabase, input) {
  const { userId, institutionId } = input;

  const existing = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Unable to query teacher row: ${existing.error.message}`);
  }

  if (existing.data) {
    const update = await supabase
      .from("teachers")
      .update({ institution_id: institutionId, specialization: "Mathematics" })
      .eq("id", existing.data.id)
      .select("id")
      .maybeSingle();

    if (update.error || !update.data) {
      throw new Error(`Unable to update teacher row: ${update.error?.message ?? "Unknown error"}`);
    }

    return update.data.id;
  }

  const insert = await supabase
    .from("teachers")
    .insert({ user_id: userId, institution_id: institutionId, specialization: "Mathematics" })
    .select("id")
    .maybeSingle();

  if (insert.error || !insert.data) {
    throw new Error(`Unable to insert teacher row: ${insert.error?.message ?? "Unknown error"}`);
  }

  return insert.data.id;
}

async function ensureStudent(supabase, input) {
  const { userId, institutionId } = input;

  const existing = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Unable to query student row: ${existing.error.message}`);
  }

  if (existing.data) {
    const update = await supabase
      .from("students")
      .update({ institution_id: institutionId, grade_level: "Grade 8" })
      .eq("id", existing.data.id)
      .select("id")
      .maybeSingle();

    if (update.error || !update.data) {
      throw new Error(`Unable to update student row: ${update.error?.message ?? "Unknown error"}`);
    }

    return update.data.id;
  }

  const insert = await supabase
    .from("students")
    .insert({ user_id: userId, institution_id: institutionId, grade_level: "Grade 8" })
    .select("id")
    .maybeSingle();

  if (insert.error || !insert.data) {
    throw new Error(`Unable to insert student row: ${insert.error?.message ?? "Unknown error"}`);
  }

  return insert.data.id;
}

function isMissingTableError(error) {
  return Boolean(error?.message?.includes("Could not find the table"));
}

function daysAgo(value) {
  const date = new Date();
  date.setDate(date.getDate() - value);
  return date.toISOString();
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const credentials = {
    admin: { email: "admin.demo@adaptive.local", password: "AdminDemo123!", role: "admin" },
    teacher: { email: "teacher.demo@adaptive.local", password: "TeacherDemo123!", role: "teacher" },
    student: { email: "student.demo@adaptive.local", password: "StudentDemo123!", role: "student" },
    parent: { email: "parent.demo@adaptive.local", password: "ParentDemo123!", role: "parent" },
  };

  await ensureUser(supabase, credentials.admin);
  const teacherUser = await ensureUser(supabase, credentials.teacher);
  const studentUser = await ensureUser(supabase, credentials.student);
  const parentUser = await ensureUser(supabase, credentials.parent);

  const institutionId = await ensureInstitution(supabase);
  const teacherId = await ensureTeacher(supabase, { userId: teacherUser.id, institutionId });
  const studentId = await ensureStudent(supabase, { userId: studentUser.id, institutionId });

  const courseInsert = await supabase
    .from("courses")
    .insert({
      title: "Foundations of Algebra",
      description: "Linear equations, expressions, and reasoning strategies.",
      teacher_id: teacherId,
    })
    .select("id")
    .maybeSingle();

  let courseId = null;
  if (courseInsert.error || !courseInsert.data) {
    const lookup = await supabase
      .from("courses")
      .select("id")
      .eq("title", "Foundations of Algebra")
      .eq("teacher_id", teacherId)
      .maybeSingle();

    if (lookup.error || !lookup.data) {
      throw new Error(`Unable to ensure course: ${courseInsert.error?.message ?? lookup.error?.message ?? "Unknown error"}`);
    }

    courseId = lookup.data.id;
  } else {
    courseId = courseInsert.data.id;
  }

  const lessonSeed = [
    {
      title: "Variables and Expressions",
      content: "Practice turning word phrases into algebraic expressions.",
      difficulty_level: "Core",
    },
    {
      title: "One-Step Equations",
      content: "Solve and verify one-step equations using inverse operations.",
      difficulty_level: "Guided",
    },
    {
      title: "Two-Step Equations",
      content: "Build confidence solving and checking multi-step problems.",
      difficulty_level: "Stretch",
    },
  ];

  const lessonIds = [];

  for (const lesson of lessonSeed) {
    const lessonInsert = await supabase
      .from("lessons")
      .insert({
        course_id: courseId,
        ...lesson,
      })
      .select("id")
      .maybeSingle();

    if (lessonInsert.error || !lessonInsert.data) {
      const lookup = await supabase
        .from("lessons")
        .select("id")
        .eq("course_id", courseId)
        .eq("title", lesson.title)
        .maybeSingle();

      if (lookup.error || !lookup.data) {
        throw new Error(`Unable to ensure lesson ${lesson.title}: ${lessonInsert.error?.message ?? lookup.error?.message ?? "Unknown error"}`);
      }

      lessonIds.push(lookup.data.id);
      continue;
    }

    lessonIds.push(lessonInsert.data.id);
  }

  const existingPath = await supabase
    .from("learning_paths")
    .select("id")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingPath.error) {
    throw new Error(`Unable to query learning path: ${existingPath.error.message}`);
  }

  if (existingPath.data) {
    const updatePath = await supabase
      .from("learning_paths")
      .update({ current_lesson_id: lessonIds[1] })
      .eq("id", existingPath.data.id);

    if (updatePath.error) {
      throw new Error(`Unable to update learning path: ${updatePath.error.message}`);
    }
  } else {
    const createPath = await supabase
      .from("learning_paths")
      .insert({ student_id: studentId, course_id: courseId, current_lesson_id: lessonIds[1] });

    if (createPath.error) {
      throw new Error(`Unable to create learning path: ${createPath.error.message}`);
    }
  }

  const progressRows = [
    { lesson_id: lessonIds[0], completion_percentage: 100, mastery_score: 86, last_accessed: daysAgo(7) },
    { lesson_id: lessonIds[1], completion_percentage: 72, mastery_score: 68, last_accessed: daysAgo(2) },
    { lesson_id: lessonIds[2], completion_percentage: 24, mastery_score: 41, last_accessed: daysAgo(1) },
  ];

  for (const row of progressRows) {
    const response = await supabase.from("progress_tracking").upsert(
      {
        student_id: studentId,
        ...row,
      },
      { onConflict: "student_id,lesson_id" },
    );

    if (response.error) {
      throw new Error(`Unable to seed progress: ${response.error.message}`);
    }
  }

  const assessmentInsert = await supabase
    .from("assessments")
    .insert({ lesson_id: lessonIds[1], type: "quiz" })
    .select("id")
    .maybeSingle();

  let assessmentId = null;
  if (assessmentInsert.error || !assessmentInsert.data) {
    const lookup = await supabase
      .from("assessments")
      .select("id")
      .eq("lesson_id", lessonIds[1])
      .eq("type", "quiz")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookup.error || !lookup.data) {
      throw new Error(`Unable to ensure assessment: ${assessmentInsert.error?.message ?? lookup.error?.message ?? "Unknown error"}`);
    }

    assessmentId = lookup.data.id;
  } else {
    assessmentId = assessmentInsert.data.id;
  }

  const questionInsert = await supabase
    .from("questions")
    .insert({
      assessment_id: assessmentId,
      question_text: "Solve for x: x + 7 = 19",
      difficulty: "Core",
      correct_answer: "12",
      explanation: "Subtract 7 from both sides to isolate x.",
    });

  if (questionInsert.error && !questionInsert.error.message.toLowerCase().includes("duplicate")) {
    const lookup = await supabase
      .from("questions")
      .select("id")
      .eq("assessment_id", assessmentId)
      .eq("question_text", "Solve for x: x + 7 = 19")
      .maybeSingle();

    if (lookup.error || !lookup.data) {
      throw new Error(`Unable to ensure question: ${questionInsert.error.message}`);
    }
  }

  const submissionUpsert = await supabase
    .from("submissions")
    .upsert(
      {
        student_id: studentId,
        assessment_id: assessmentId,
        score: 78,
        submitted_at: daysAgo(1),
      },
      { onConflict: "student_id,assessment_id" },
    );

  if (submissionUpsert.error) {
    throw new Error(`Unable to seed submission: ${submissionUpsert.error.message}`);
  }

  const achievementSeed = [
    { title: "Equation Starter", badge: "Bronze", awarded_at: daysAgo(5) },
    { title: "Consistency Streak", badge: "Silver", awarded_at: daysAgo(2) },
  ];

  const achievementProbe = await supabase.from("achievements").select("id").limit(1);

  if (!achievementProbe.error) {
    for (const achievement of achievementSeed) {
      const exists = await supabase
        .from("achievements")
        .select("id")
        .eq("student_id", studentId)
        .eq("title", achievement.title)
        .maybeSingle();

      if (!exists.error && exists.data) {
        continue;
      }

      const response = await supabase.from("achievements").insert({ student_id: studentId, ...achievement });
      if (response.error) {
        throw new Error(`Unable to seed achievements: ${response.error.message}`);
      }
    }
  } else if (!isMissingTableError(achievementProbe.error)) {
    throw new Error(`Unable to probe achievements table: ${achievementProbe.error.message}`);
  }

  const parentProbe = await supabase.from("parent_accounts").select("id").limit(1);

  if (!parentProbe.error) {
    const existingParentLink = await supabase
      .from("parent_accounts")
      .select("id")
      .eq("user_id", parentUser.id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existingParentLink.error) {
      throw new Error(`Unable to query parent linkage: ${existingParentLink.error.message}`);
    }

    if (!existingParentLink.data) {
      const parentLink = await supabase
        .from("parent_accounts")
        .insert({ user_id: parentUser.id, student_id: studentId, relationship: "Guardian" });

      if (parentLink.error) {
        throw new Error(`Unable to seed parent linkage: ${parentLink.error.message}`);
      }
    }
  } else if (!isMissingTableError(parentProbe.error)) {
    throw new Error(`Unable to probe parent_accounts table: ${parentProbe.error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        seeded: true,
        institutionId,
        courseId,
        lessonIds,
        credentials,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

