import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function daysAgo(value) {
  const date = new Date();
  date.setDate(date.getDate() - value);
  return date.toISOString();
}

async function firstRow(query, errorPrefix) {
  const response = await query.limit(1);
  if (response.error) {
    throw new Error(`${errorPrefix}: ${response.error.message}`);
  }
  return response.data?.[0] ?? null;
}

async function ensureUser(supabase, input) {
  const { email, password, role } = input;
  const usersResponse = await supabase.auth.admin.listUsers();

  if (usersResponse.error) {
    throw new Error(`Unable to list auth users: ${usersResponse.error.message}`);
  }

  const existing = usersResponse.data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    const updateResponse = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { role },
    });

    if (updateResponse.error || !updateResponse.data.user) {
      throw new Error(`Unable to update user ${email}: ${updateResponse.error?.message ?? "Unknown error"}`);
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
  const existing = await firstRow(
    supabase.from("institutions").select("id").eq("name", "Demo STEM Academy"),
    "Unable to query institutions",
  );

  if (existing?.id) {
    return existing.id;
  }

  const insertResponse = await supabase
    .from("institutions")
    .insert({ name: "Demo STEM Academy", location: "Austin, TX" })
    .select("id")
    .single();

  if (insertResponse.error || !insertResponse.data) {
    throw new Error(`Unable to create institution: ${insertResponse.error?.message ?? "Unknown error"}`);
  }

  return insertResponse.data.id;
}

async function ensureTeacherRow(supabase, { userId, institutionId }) {
  const existing = await firstRow(
    supabase.from("teachers").select("id").eq("user_id", userId).order("created_at", { ascending: true }),
    "Unable to query teachers",
  );

  if (existing?.id) {
    await supabase
      .from("teachers")
      .update({ institution_id: institutionId, specialization: "Mathematics" })
      .eq("id", existing.id);
    return existing.id;
  }

  const insertResponse = await supabase
    .from("teachers")
    .insert({ user_id: userId, institution_id: institutionId, specialization: "Mathematics" })
    .select("id")
    .single();

  if (insertResponse.error || !insertResponse.data) {
    throw new Error(`Unable to create teacher row: ${insertResponse.error?.message ?? "Unknown error"}`);
  }

  return insertResponse.data.id;
}

async function ensureStudentRow(supabase, { userId, institutionId }) {
  const existing = await firstRow(
    supabase.from("students").select("id").eq("user_id", userId).order("created_at", { ascending: true }),
    "Unable to query students",
  );

  if (existing?.id) {
    await supabase
      .from("students")
      .update({ institution_id: institutionId, grade_level: "Grade 8" })
      .eq("id", existing.id);
    return existing.id;
  }

  const insertResponse = await supabase
    .from("students")
    .insert({ user_id: userId, institution_id: institutionId, grade_level: "Grade 8" })
    .select("id")
    .single();

  if (insertResponse.error || !insertResponse.data) {
    throw new Error(`Unable to create student row: ${insertResponse.error?.message ?? "Unknown error"}`);
  }

  return insertResponse.data.id;
}

async function ensureCourse(supabase, teacherId) {
  const existing = await firstRow(
    supabase
      .from("courses")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("title", "Foundations of Algebra"),
    "Unable to query courses",
  );

  if (existing?.id) {
    return existing.id;
  }

  const insertResponse = await supabase
    .from("courses")
    .insert({
      title: "Foundations of Algebra",
      description: "Linear equations, expressions, and reasoning strategies.",
      teacher_id: teacherId,
    })
    .select("id")
    .single();

  if (insertResponse.error || !insertResponse.data) {
    throw new Error(`Unable to create course: ${insertResponse.error?.message ?? "Unknown error"}`);
  }

  return insertResponse.data.id;
}

async function ensureLessons(supabase, courseId) {
  const definitions = [
    {
      title: "Variables and Expressions",
      content:
        "Students translate real-world phrases into algebraic expressions, identify terms and coefficients, and explain variable meaning in context. Includes worked examples and independent practice with immediate checks.",
      difficulty_level: "Core",
    },
    {
      title: "One-Step Equations",
      content:
        "Learners solve one-step equations using inverse operations, justify each step, and verify solutions by substitution. The lesson emphasizes precision, error analysis, and strategy selection.",
      difficulty_level: "Guided",
    },
    {
      title: "Two-Step Equations",
      content:
        "This lesson extends to multi-step reasoning with parentheses and integer operations. Students compare multiple solution paths, troubleshoot misconceptions, and communicate mathematical reasoning clearly.",
      difficulty_level: "Stretch",
    },
  ];

  const lessonIds = [];

  for (const lesson of definitions) {
    const existing = await firstRow(
      supabase
        .from("lessons")
        .select("id")
        .eq("course_id", courseId)
        .eq("title", lesson.title),
      `Unable to query lesson ${lesson.title}`,
    );

    if (existing?.id) {
      await supabase
        .from("lessons")
        .update({ content: lesson.content, difficulty_level: lesson.difficulty_level })
        .eq("id", existing.id);
      lessonIds.push(existing.id);
      continue;
    }

    const insertResponse = await supabase
      .from("lessons")
      .insert({ ...lesson, course_id: courseId })
      .select("id")
      .single();

    if (insertResponse.error || !insertResponse.data) {
      throw new Error(`Unable to create lesson ${lesson.title}: ${insertResponse.error?.message ?? "Unknown error"}`);
    }

    lessonIds.push(insertResponse.data.id);
  }

  return lessonIds;
}

async function ensureLearningPath(supabase, { studentId, courseId, currentLessonId }) {
  const existing = await firstRow(
    supabase
      .from("learning_paths")
      .select("id")
      .eq("student_id", studentId)
      .eq("course_id", courseId),
    "Unable to query learning_paths",
  );

  if (existing?.id) {
    const updateResponse = await supabase
      .from("learning_paths")
      .update({ current_lesson_id: currentLessonId })
      .eq("id", existing.id);

    if (updateResponse.error) {
      throw new Error(`Unable to update learning path: ${updateResponse.error.message}`);
    }

    return;
  }

  const insertResponse = await supabase
    .from("learning_paths")
    .insert({ student_id: studentId, course_id: courseId, current_lesson_id: currentLessonId });

  if (insertResponse.error) {
    throw new Error(`Unable to create learning path: ${insertResponse.error.message}`);
  }
}

async function ensureProgress(supabase, studentId, lessonIds, profile = "core") {
  const profileRows = {
    core: [
      { lesson_id: lessonIds[0], completion_percentage: 100, mastery_score: 86, last_accessed: daysAgo(7) },
      { lesson_id: lessonIds[1], completion_percentage: 72, mastery_score: 68, last_accessed: daysAgo(2) },
      { lesson_id: lessonIds[2], completion_percentage: 24, mastery_score: 41, last_accessed: daysAgo(1) },
    ],
    advanced: [
      { lesson_id: lessonIds[0], completion_percentage: 100, mastery_score: 94, last_accessed: daysAgo(6) },
      { lesson_id: lessonIds[1], completion_percentage: 96, mastery_score: 91, last_accessed: daysAgo(2) },
      { lesson_id: lessonIds[2], completion_percentage: 84, mastery_score: 88, last_accessed: daysAgo(1) },
    ],
    support: [
      { lesson_id: lessonIds[0], completion_percentage: 52, mastery_score: 48, last_accessed: daysAgo(4) },
      { lesson_id: lessonIds[1], completion_percentage: 37, mastery_score: 39, last_accessed: daysAgo(2) },
      { lesson_id: lessonIds[2], completion_percentage: 12, mastery_score: 28, last_accessed: daysAgo(1) },
    ],
  };

  const progressRows = profileRows[profile] ?? profileRows.core;

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
}

async function ensureStandardsAndObjectives(supabase, lessonIds) {
  const standardCodes = ["CCSS.8.EE.A.1", "CCSS.8.EE.B.5", "CCSS.8.EE.C.7"];
  const objectiveTemplates = [
    "Translate algebraic phrases into expressions accurately.",
    "Solve equations and verify each step.",
    "Interpret equation structure to choose a solving strategy.",
  ];

  const standardsByCode = new Map();
  for (const code of standardCodes) {
    const existing = await firstRow(
      supabase.from("standards").select("id, code").eq("code", code),
      `Unable to query standard ${code}`,
    );

    if (existing?.id) {
      standardsByCode.set(code, existing.id);
      continue;
    }

    const insertResponse = await supabase
      .from("standards")
      .insert({ code, description: `Algebra alignment for ${code}` })
      .select("id, code")
      .single();

    if (insertResponse.error || !insertResponse.data) {
      continue;
    }

    standardsByCode.set(code, insertResponse.data.id);
  }

  const objectiveIdsByLesson = new Map();

  for (let index = 0; index < lessonIds.length; index += 1) {
    const lessonId = lessonIds[index];
    const objective = objectiveTemplates[index % objectiveTemplates.length];

    const existing = await firstRow(
      supabase
        .from("learning_objectives")
        .select("id")
        .eq("lesson_id", lessonId)
        .eq("objective", objective),
      `Unable to query objective for lesson ${lessonId}`,
    );

    if (existing?.id) {
      objectiveIdsByLesson.set(lessonId, existing.id);
      continue;
    }

    const payload = {
      lesson_id: lessonId,
      objective,
      standard_id: standardsByCode.get(standardCodes[index % standardCodes.length]) ?? null,
    };

    let insertResponse = await supabase
      .from("learning_objectives")
      .insert(payload)
      .select("id")
      .single();

    if (insertResponse.error) {
      insertResponse = await supabase
        .from("learning_objectives")
        .insert({ lesson_id: lessonId, objective })
        .select("id")
        .single();
    }

    if (insertResponse.error || !insertResponse.data) {
      continue;
    }

    objectiveIdsByLesson.set(lessonId, insertResponse.data.id);
  }

  return objectiveIdsByLesson;
}

async function ensureContentItems(supabase, lessonIds, objectiveIdsByLesson) {
  const contentTemplates = [
    { type: "video", category: "Concept video", title: "Intro walkthrough", summary: "A short explainer on expressions." },
    { type: "interactive", category: "Practice lab", title: "Equation sandbox", summary: "Interactive one-step equation drills." },
    { type: "text", category: "Lesson notes", title: "Worked examples", summary: "Step-by-step examples and checks." },
  ];

  for (let index = 0; index < lessonIds.length; index += 1) {
    const lessonId = lessonIds[index];
    const template = contentTemplates[index % contentTemplates.length];

    const existing = await firstRow(
      supabase
        .from("content_items")
        .select("id")
        .eq("lesson_id", lessonId)
        .eq("type", template.type),
      `Unable to query content item for lesson ${lessonId}`,
    );

    if (existing?.id) {
      continue;
    }

    const metadata = {
      title: template.title,
      summary: template.summary,
      category: template.category,
      tags: ["algebra", "demo"],
    };

    const payload = {
      lesson_id: lessonId,
      type: template.type,
      url: `https://example.com/resources/${lessonId}/${template.type}`,
      metadata,
      learning_objective_id: objectiveIdsByLesson.get(lessonId) ?? null,
    };

    let insertResponse = await supabase.from("content_items").insert(payload);

    if (insertResponse.error) {
      insertResponse = await supabase.from("content_items").insert({
        lesson_id: lessonId,
        type: template.type,
        url: payload.url,
        metadata,
      });
    }

    if (insertResponse.error) {
      throw new Error(`Unable to seed content item for lesson ${lessonId}: ${insertResponse.error.message}`);
    }
  }
}

async function ensureAssessmentFlow(supabase, { lessonId, studentId, courseId, score = 78 }) {
  const assessment = await firstRow(
    supabase
      .from("assessments")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("type", "quiz"),
    "Unable to query assessment",
  );

  let assessmentId = assessment?.id ?? null;

  if (!assessmentId) {
    const insertResponse = await supabase
      .from("assessments")
      .insert({ lesson_id: lessonId, type: "quiz" })
      .select("id")
      .single();

    if (insertResponse.error || !insertResponse.data) {
      throw new Error(`Unable to create assessment: ${insertResponse.error?.message ?? "Unknown error"}`);
    }

    assessmentId = insertResponse.data.id;
  }

  const questionBank = [
    {
      question_text: "Solve for x: x + 7 = 19",
      difficulty: "Core",
      correct_answer: "12",
      explanation: "Subtract 7 from both sides to isolate x.",
    },
    {
      question_text: "Simplify: 3(2x - 4) + 5",
      difficulty: "Core",
      correct_answer: "6x - 7",
      explanation: "Distribute 3 across the parentheses, then combine like terms.",
    },
    {
      question_text: "Solve: 4x - 9 = 15",
      difficulty: "Guided",
      correct_answer: "6",
      explanation: "Add 9 to both sides, then divide by 4.",
    },
    {
      question_text: "A phone plan costs 12 dollars plus 3 dollars per GB. Write an expression for g GB.",
      difficulty: "Guided",
      correct_answer: "12 + 3g",
      explanation: "Use fixed cost plus variable cost times usage.",
    },
    {
      question_text: "Explain why dividing both sides of an equation by the same non-zero number keeps it balanced.",
      difficulty: "Stretch",
      correct_answer: "Equivalent operations preserve equality",
      explanation: "Both sides are scaled equally, so the relationship stays true.",
    },
  ];

  for (const question of questionBank) {
    const existingQuestion = await firstRow(
      supabase
        .from("questions")
        .select("id")
        .eq("assessment_id", assessmentId)
        .eq("question_text", question.question_text),
      `Unable to query seeded question ${question.question_text}`,
    );

    if (existingQuestion?.id) {
      continue;
    }

    const insertQuestion = await supabase.from("questions").insert({
      assessment_id: assessmentId,
      ...question,
    });

    if (insertQuestion.error) {
      throw new Error(`Unable to seed question: ${insertQuestion.error.message}`);
    }
  }

  const upsertSubmission = await supabase.from("submissions").upsert(
    {
      student_id: studentId,
      assessment_id: assessmentId,
      score,
      submitted_at: daysAgo(1),
    },
    { onConflict: "student_id,assessment_id" },
  );

  if (upsertSubmission.error) {
    throw new Error(`Unable to seed submission: ${upsertSubmission.error.message}`);
  }

  await ensureLearningPath(supabase, {
    studentId,
    courseId,
    currentLessonId: lessonId,
  });
}

async function ensureAchievements(supabase, studentId) {
  const rows = [
    { title: "Equation Starter", badge: "Bronze", awarded_at: daysAgo(5) },
    { title: "Consistency Streak", badge: "Silver", awarded_at: daysAgo(2) },
  ];

  for (const row of rows) {
    const existing = await firstRow(
      supabase
        .from("achievements")
        .select("id")
        .eq("student_id", studentId)
        .eq("title", row.title),
      `Unable to query achievement ${row.title}`,
    );

    if (existing?.id) {
      continue;
    }

    const insertResponse = await supabase
      .from("achievements")
      .insert({ student_id: studentId, ...row });

    if (insertResponse.error) {
      throw new Error(`Unable to seed achievement ${row.title}: ${insertResponse.error.message}`);
    }
  }
}

async function ensureParentLink(supabase, { parentUserId, studentId }) {
  const existing = await firstRow(
    supabase
      .from("parent_accounts")
      .select("id")
      .eq("user_id", parentUserId)
      .eq("student_id", studentId),
    "Unable to query parent linkage",
  );

  if (existing?.id) {
    return;
  }

  const insertResponse = await supabase
    .from("parent_accounts")
    .insert({ user_id: parentUserId, student_id: studentId, relationship: "Guardian" });

  if (insertResponse.error) {
    throw new Error(`Unable to seed parent linkage: ${insertResponse.error.message}`);
  }
}

async function getCounts(supabase, lessonIds, courseId, studentId) {
  const counts = {};

  const tables = [
    ["courses", supabase.from("courses").select("id", { count: "exact", head: true }).eq("id", courseId)],
    ["lessons", supabase.from("lessons").select("id", { count: "exact", head: true }).in("id", lessonIds)],
    ["learning_objectives", supabase.from("learning_objectives").select("id", { count: "exact", head: true }).in("lesson_id", lessonIds)],
    ["content_items", supabase.from("content_items").select("id", { count: "exact", head: true }).in("lesson_id", lessonIds)],
    ["progress_tracking", supabase.from("progress_tracking").select("id", { count: "exact", head: true }).eq("student_id", studentId).in("lesson_id", lessonIds)],
    ["assessments", supabase.from("assessments").select("id", { count: "exact", head: true }).in("lesson_id", lessonIds)],
    ["questions", supabase.from("questions").select("id", { count: "exact", head: true })],
    ["submissions", supabase.from("submissions").select("id", { count: "exact", head: true }).eq("student_id", studentId)],
    ["achievements", supabase.from("achievements").select("id", { count: "exact", head: true }).eq("student_id", studentId)],
    ["parent_accounts", supabase.from("parent_accounts").select("id", { count: "exact", head: true }).eq("student_id", studentId)],
  ];

  for (const [label, query] of tables) {
    const response = await query;
    counts[label] = response.error ? null : response.count ?? 0;
  }

  return counts;
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const credentials = {
    admin: { email: "admin.demo@adaptive.local", password: "AdminDemo123!", role: "admin" },
    teacher: { email: "teacher.demo@adaptive.local", password: "TeacherDemo123!", role: "teacher" },
    student: { email: "student.demo@adaptive.local", password: "StudentDemo123!", role: "student" },
    studentAdvanced: { email: "student.advanced@adaptive.local", password: "StudentAdvanced123!", role: "student" },
    studentSupport: { email: "student.support@adaptive.local", password: "StudentSupport123!", role: "student" },
    parent: { email: "parent.demo@adaptive.local", password: "ParentDemo123!", role: "parent" },
    parentSecond: { email: "parent.second@adaptive.local", password: "ParentSecond123!", role: "parent" },
  };

  const adminUser = await ensureUser(supabase, credentials.admin);
  const teacherUser = await ensureUser(supabase, credentials.teacher);
  const studentUser = await ensureUser(supabase, credentials.student);
  const studentAdvancedUser = await ensureUser(supabase, credentials.studentAdvanced);
  const studentSupportUser = await ensureUser(supabase, credentials.studentSupport);
  const parentUser = await ensureUser(supabase, credentials.parent);
  const parentSecondUser = await ensureUser(supabase, credentials.parentSecond);

  const institutionId = await ensureInstitution(supabase);
  const teacherId = await ensureTeacherRow(supabase, {
    userId: teacherUser.id,
    institutionId,
  });
  const studentId = await ensureStudentRow(supabase, {
    userId: studentUser.id,
    institutionId,
  });
  const studentAdvancedId = await ensureStudentRow(supabase, {
    userId: studentAdvancedUser.id,
    institutionId,
  });
  const studentSupportId = await ensureStudentRow(supabase, {
    userId: studentSupportUser.id,
    institutionId,
  });

  const courseId = await ensureCourse(supabase, teacherId);
  const lessonIds = await ensureLessons(supabase, courseId);

  const objectiveIdsByLesson = await ensureStandardsAndObjectives(supabase, lessonIds);
  await ensureContentItems(supabase, lessonIds, objectiveIdsByLesson);

  const teacherCoursesResponse = await supabase
    .from("courses")
    .select("id")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: true });

  if (teacherCoursesResponse.error) {
    throw new Error(`Unable to query teacher courses: ${teacherCoursesResponse.error.message}`);
  }

  const teacherCourseIds = [
    ...new Set([
      courseId,
      ...(teacherCoursesResponse.data ?? []).map((course) => course.id),
    ]),
  ];

  const lessonsByCourse = new Map();
  for (const teacherCourseId of teacherCourseIds) {
    const courseLessonsResponse = await supabase
      .from("lessons")
      .select("id")
      .eq("course_id", teacherCourseId)
      .order("created_at", { ascending: true });

    if (courseLessonsResponse.error) {
      throw new Error(`Unable to query lessons for course ${teacherCourseId}: ${courseLessonsResponse.error.message}`);
    }

    lessonsByCourse.set(teacherCourseId, courseLessonsResponse.data ?? []);
  }

  const studentProfiles = [
    { studentId, currentLessonId: lessonIds[1], progressProfile: "core", assessmentScore: 78 },
    { studentId: studentAdvancedId, currentLessonId: lessonIds[2], progressProfile: "advanced", assessmentScore: 92 },
    { studentId: studentSupportId, currentLessonId: lessonIds[0], progressProfile: "support", assessmentScore: 56 },
  ];

  for (const learner of studentProfiles) {
    for (const teacherCourseId of teacherCourseIds) {
      const courseLessonRows = lessonsByCourse.get(teacherCourseId) ?? [];
      const defaultLessonId =
        teacherCourseId === courseId
          ? learner.currentLessonId
          : (courseLessonRows[0]?.id ?? null);

      await ensureLearningPath(supabase, {
        studentId: learner.studentId,
        courseId: teacherCourseId,
        currentLessonId: defaultLessonId,
      });
    }

    await ensureProgress(supabase, learner.studentId, lessonIds, learner.progressProfile);

    await ensureAssessmentFlow(supabase, {
      lessonId: lessonIds[1],
      studentId: learner.studentId,
      courseId,
      score: learner.assessmentScore,
    });

    await ensureAchievements(supabase, learner.studentId);
  }

  await ensureParentLink(supabase, {
    parentUserId: parentUser.id,
    studentId,
  });
  await ensureParentLink(supabase, {
    parentUserId: parentSecondUser.id,
    studentId: studentAdvancedId,
  });

  const counts = await getCounts(supabase, lessonIds, courseId, studentId);

  console.log(
    JSON.stringify(
      {
        seeded: true,
        institutionId,
        teacherId,
        studentId,
        courseId,
        lessonIds,
        tableCounts: counts,
        credentials,
      },
      null,
      2,
    ),
  );

  void adminUser;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});







