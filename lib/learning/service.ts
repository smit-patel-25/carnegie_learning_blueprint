import type { SupabaseClient } from "@supabase/supabase-js";

import { syncLearningPathForStudent } from "@/lib/learning/pathway";
import { ensureViewerRoleRecordsForUser } from "@/lib/supabase/role-provision";
import {
  courseDetailSchema,
  courseIdInputSchema,
  courseSchema,
  courseSummarySchema,
  learningPathSchema,
  lessonSchema,
  progressSchema,
  recordProgressInputSchema,
  teacherCourseAnalyticsSchema,
  type Course,
  type CourseDetail,
  type CourseSummary,
  type LearningPath,
  type Lesson,
  type ProgressRecord,
  type RecordProgressInput,
  type TeacherCourseAnalytics,
} from "@/lib/validations/learning";

type ViewerRole = "student" | "teacher" | "admin" | "parent";

type ViewerContext = {
  userId: string;
  role: ViewerRole;
  studentId: string | null;
  teacherId: string | null;
};

type ServiceResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

type StudentRow = {
  id: string;
  grade_level: string | null;
};

async function getViewerContext(
  supabase: SupabaseClient,
): Promise<ServiceResult<ViewerContext>> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to continue." };
  }

  const ensuredContext = await ensureViewerRoleRecordsForUser({
    userId: user.id,
    metadataRole: user.user_metadata?.role,
  });

  const profileResponse = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResponse.error && !ensuredContext) {
    return { error: "Your profile could not be loaded." };
  }

  const role = (profileResponse.data?.role ?? ensuredContext?.role ?? "student") as ViewerRole;

  let studentId: string | null = null;
  let teacherId: string | null = null;

  if (role === "student") {
    const studentResponse = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (studentResponse.error) {
      return { error: "Your student record could not be loaded." };
    }

    studentId = studentResponse.data?.[0]?.id ?? null;
  }

  if (role === "teacher") {
    const teacherResponse = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (teacherResponse.error) {
      return { error: "Your teacher record could not be loaded." };
    }

    teacherId = teacherResponse.data?.[0]?.id ?? null;
  }

  return {
    data: {
      userId: user.id,
      role,
      studentId,
      teacherId,
    },
  };
}
function getProgressValue(
  progressMap: Map<string, ProgressRecord>,
  studentId: string,
  lessonId: string,
  field: "completion_percentage" | "mastery_score",
) {
  return progressMap.get(`${studentId}:${lessonId}`)?.[field] ?? 0;
}

function roundMetric(value: number) {
  return Math.round(value);
}

function buildProgressMap(progressRows: ProgressRecord[]) {
  return new Map(progressRows.map((row) => [`${row.student_id}:${row.lesson_id}`, row]));
}

async function getTeacherProgressContext(
  supabase: SupabaseClient,
  courseIds: string[],
  lessons: Lesson[],
): Promise<
  ServiceResult<{
    learningPaths: LearningPath[];
    progressRows: ProgressRecord[];
    students: StudentRow[];
  }>
> {
  if (courseIds.length === 0) {
    return { data: { learningPaths: [], progressRows: [], students: [] } };
  }

  const learningPathsResponse = await supabase
    .from("learning_paths")
    .select("student_id, course_id, current_lesson_id")
    .in("course_id", courseIds);

  if (learningPathsResponse.error) {
    return { error: "Course enrolments could not be loaded." };
  }

  const learningPaths = learningPathSchema.array().parse(learningPathsResponse.data ?? []);
  const studentIds = [...new Set(learningPaths.map((path) => path.student_id))];

  if (studentIds.length === 0) {
    return { data: { learningPaths, progressRows: [], students: [] } };
  }

  const studentsResponse = await supabase
    .from("students")
    .select("id, grade_level")
    .in("id", studentIds)
    .order("created_at", { ascending: true });

  if (studentsResponse.error) {
    return { error: "Learner records could not be loaded." };
  }

  const students = (studentsResponse.data ?? []) as StudentRow[];

  if (lessons.length === 0) {
    return { data: { learningPaths, progressRows: [], students } };
  }

  const progressResponse = await supabase
    .from("progress_tracking")
    .select(
      "id, student_id, lesson_id, completion_percentage, mastery_score, last_accessed",
    )
    .in("student_id", studentIds)
    .in(
      "lesson_id",
      lessons.map((lesson) => lesson.id),
    );

  if (progressResponse.error) {
    return { error: "Class progress could not be loaded." };
  }

  return {
    data: {
      learningPaths,
      progressRows: progressSchema.array().parse(progressResponse.data ?? []),
      students,
    },
  };
}

export async function listCoursesForViewer(
  supabase: SupabaseClient,
): Promise<ServiceResult<CourseSummary[]>> {
  const viewerResult = await getViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your account context could not be resolved." };
  }

  const { role, studentId, teacherId } = viewer;

  if (role === "student" && !studentId) {
    return { data: [] };
  }

  if (role === "teacher" && !teacherId) {
    return { data: [] };
  }

  let courses: Course[] = [];
  let learningPaths: LearningPath[] = [];

  if (role === "student" && studentId) {
    const learningPathResponse = await supabase
      .from("learning_paths")
      .select("student_id, course_id, current_lesson_id")
      .eq("student_id", studentId);

    if (learningPathResponse.error) {
      return { error: "Assigned learning paths could not be loaded." };
    }

    learningPaths = learningPathSchema.array().parse(learningPathResponse.data ?? []);

    const courseIds = learningPaths.map((path) => path.course_id);

    if (courseIds.length === 0) {
      return { data: [] };
    }

    const courseResponse = await supabase
      .from("courses")
      .select("id, title, description, teacher_id, curriculum_id, created_at")
      .in("id", courseIds)
      .order("created_at", { ascending: false });

    if (courseResponse.error) {
      return { error: "Courses could not be loaded." };
    }

    courses = courseSchema.array().parse(courseResponse.data ?? []);
  } else if (role === "teacher" && teacherId) {
    const courseResponse = await supabase
      .from("courses")
      .select("id, title, description, teacher_id, curriculum_id, created_at")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (courseResponse.error) {
      return { error: "Courses could not be loaded." };
    }

    courses = courseSchema.array().parse(courseResponse.data ?? []);
  } else if (role === "admin") {
    const courseResponse = await supabase
      .from("courses")
      .select("id, title, description, teacher_id, curriculum_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (courseResponse.error) {
      return { error: "Courses could not be loaded." };
    }

    courses = courseSchema.array().parse(courseResponse.data ?? []);
  } else {
    return { data: [] };
  }

  if (courses.length === 0) {
    return { data: [] };
  }

  const courseIds = courses.map((course) => course.id);
  const lessonsResponse = await supabase
    .from("lessons")
    .select("id, course_id, title, content, difficulty_level, created_at")
    .in("course_id", courseIds);

  if (lessonsResponse.error) {
    return { error: "Lessons could not be loaded." };
  }

  const lessons = lessonSchema.array().parse(lessonsResponse.data ?? []);
  const lessonsByCourse = new Map<string, Lesson[]>();

  lessons.forEach((lesson) => {
    const group = lessonsByCourse.get(lesson.course_id) ?? [];
    group.push(lesson);
    lessonsByCourse.set(lesson.course_id, group);
  });

  const progressByLesson = new Map<string, ProgressRecord>();
  const teacherProgressMap = new Map<string, ProgressRecord>();
  let teacherPaths: LearningPath[] = [];

  if (role === "student" && studentId && lessons.length > 0) {
    const progressResponse = await supabase
      .from("progress_tracking")
      .select(
        "id, student_id, lesson_id, completion_percentage, mastery_score, last_accessed",
      )
      .eq("student_id", studentId)
      .in(
        "lesson_id",
        lessons.map((lesson) => lesson.id),
      );

    if (progressResponse.error) {
      return { error: "Progress data could not be loaded." };
    }

    const progressRows = progressSchema.array().parse(progressResponse.data ?? []);

    progressRows.forEach((row) => {
      progressByLesson.set(row.lesson_id, row);
    });
  }

  if (role === "teacher") {
    const teacherContext = await getTeacherProgressContext(supabase, courseIds, lessons);

    if (teacherContext.error) {
      return teacherContext;
    }

    const teacherData = teacherContext.data;

    if (!teacherData) {
      return { error: "Class progress could not be loaded." };
    }

    teacherPaths = teacherData.learningPaths;
    teacherData.progressRows.forEach((row) => {
      teacherProgressMap.set(`${row.student_id}:${row.lesson_id}`, row);
    });
  }

  const summaries = courses.map((course) => {
    const lessonGroup = lessonsByCourse.get(course.id) ?? [];
    const totalLessons = lessonGroup.length;
    let completionPercentage = 0;

    if (role === "student") {
      completionPercentage =
        totalLessons === 0
          ? 0
          : roundMetric(
              lessonGroup.reduce((sum, lesson) => {
                return sum + (progressByLesson.get(lesson.id)?.completion_percentage ?? 0);
              }, 0) / totalLessons,
            );
    } else if (role === "teacher") {
      const courseStudentIds = [
        ...new Set(
          teacherPaths
            .filter((path) => path.course_id === course.id)
            .map((path) => path.student_id),
        ),
      ];

      if (courseStudentIds.length > 0 && totalLessons > 0) {
        const totalProgress = courseStudentIds.reduce((sum, currentStudentId) => {
          return (
            sum +
            lessonGroup.reduce((lessonSum, lesson) => {
              return (
                lessonSum +
                getProgressValue(
                  teacherProgressMap,
                  currentStudentId,
                  lesson.id,
                  "completion_percentage",
                )
              );
            }, 0)
          );
        }, 0);

        completionPercentage = roundMetric(
          totalProgress / (courseStudentIds.length * totalLessons),
        );
      }
    }

    const currentLessonId =
      role === "student"
        ? learningPaths.find((path) => path.course_id === course.id)?.current_lesson_id ?? null
        : null;

    return {
      id: course.id,
      title: course.title,
      description: course.description ?? "A guided learning experience ready for progress.",
      lessonCount: totalLessons,
      completionPercentage,
      currentLessonId,
    };
  });

  return { data: courseSummarySchema.array().parse(summaries) };
}

export async function getCourseDetailsForViewer(
  supabase: SupabaseClient,
  courseIdInput: { courseId: string },
): Promise<ServiceResult<CourseDetail | null>> {
  const parsedCourseId = courseIdInputSchema.safeParse(courseIdInput);

  if (!parsedCourseId.success) {
    return { error: parsedCourseId.error.issues[0]?.message ?? "Invalid course." };
  }

  const viewerResult = await getViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your account context could not be resolved." };
  }

  const { role, studentId } = viewer;
  const courseId = parsedCourseId.data.courseId;

  const courseResponse = await supabase
    .from("courses")
    .select("id, title, description, teacher_id, curriculum_id, created_at")
    .eq("id", courseId)
    .maybeSingle();

  if (courseResponse.error) {
    return { error: "Course details could not be loaded." };
  }

  if (!courseResponse.data) {
    return { data: null };
  }

  const course = courseSchema.parse(courseResponse.data);

  const lessonsResponse = await supabase
    .from("lessons")
    .select("id, course_id, title, content, difficulty_level, created_at")
    .eq("course_id", course.id)
    .order("created_at", { ascending: true });

  if (lessonsResponse.error) {
    return { error: "Lessons could not be loaded." };
  }

  const lessons = lessonSchema.array().parse(lessonsResponse.data ?? []);
  let progressRows: ProgressRecord[] = [];
  let teacherProgressMap = new Map<string, ProgressRecord>();
  let teacherPaths: LearningPath[] = [];

  if (role === "student" && studentId && lessons.length > 0) {
    const progressResponse = await supabase
      .from("progress_tracking")
      .select(
        "id, student_id, lesson_id, completion_percentage, mastery_score, last_accessed",
      )
      .eq("student_id", studentId)
      .in(
        "lesson_id",
        lessons.map((lesson) => lesson.id),
      );

    if (progressResponse.error) {
      return { error: "Progress details could not be loaded." };
    }

    progressRows = progressSchema.array().parse(progressResponse.data ?? []);
  }

  if (role === "teacher") {
    const teacherContext = await getTeacherProgressContext(supabase, [course.id], lessons);

    if (teacherContext.error) {
      return teacherContext;
    }

    const teacherData = teacherContext.data;

    if (!teacherData) {
      return { error: "Class progress could not be loaded." };
    }

    teacherPaths = teacherData.learningPaths;
    teacherProgressMap = buildProgressMap(teacherData.progressRows);
  }

  const progressByLesson = new Map(progressRows.map((row) => [row.lesson_id, row]));
  const teacherStudentIds = [
    ...new Set(teacherPaths.map((path) => path.student_id)),
  ];

  return {
    data: courseDetailSchema.parse({
      course: {
        id: course.id,
        title: course.title,
        description:
          course.description ?? "This course is ready for structured learning and review.",
      },
      lessons: lessons.map((lesson) => {
        const progress = progressByLesson.get(lesson.id);
        let completionPercentage = progress?.completion_percentage ?? 0;
        let masteryScore = progress?.mastery_score ?? 0;

        if (role === "teacher" && teacherStudentIds.length > 0) {
          completionPercentage = roundMetric(
            teacherStudentIds.reduce((sum, currentStudentId) => {
              return (
                sum +
                getProgressValue(
                  teacherProgressMap,
                  currentStudentId,
                  lesson.id,
                  "completion_percentage",
                )
              );
            }, 0) / teacherStudentIds.length,
          );
          masteryScore = roundMetric(
            teacherStudentIds.reduce((sum, currentStudentId) => {
              return (
                sum +
                getProgressValue(
                  teacherProgressMap,
                  currentStudentId,
                  lesson.id,
                  "mastery_score",
                )
              );
            }, 0) / teacherStudentIds.length,
          );
        }

        return {
          id: lesson.id,
          title: lesson.title,
          content: lesson.content ?? "Lesson content will appear here as curriculum is added.",
          difficultyLevel: lesson.difficulty_level ?? "Core",
          completionPercentage,
          masteryScore,
          lastAccessed: progress?.last_accessed ?? null,
        };
      }),
      canRecordProgress: role === "student" && Boolean(studentId),
      viewerRole: role,
    }),
  };
}

export async function getTeacherCourseAnalyticsForViewer(
  supabase: SupabaseClient,
  courseIdInput: { courseId: string },
): Promise<ServiceResult<TeacherCourseAnalytics | null>> {
  const parsedCourseId = courseIdInputSchema.safeParse(courseIdInput);

  if (!parsedCourseId.success) {
    return { error: parsedCourseId.error.issues[0]?.message ?? "Invalid course." };
  }

  const viewerResult = await getViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your account context could not be resolved." };
  }

  if (viewer.role !== "teacher" && viewer.role !== "admin") {
    return { error: "Only teachers or admins can access class analytics." };
  }

  const courseResult = await getCourseDetailsForViewer(supabase, parsedCourseId.data);

  if (courseResult.error) {
    return courseResult;
  }

  if (!courseResult.data) {
    return { data: null };
  }

  const lessons = lessonSchema.array().parse(
    courseResult.data.lessons.map((lesson) => ({
      id: lesson.id,
      course_id: parsedCourseId.data.courseId,
      title: lesson.title,
      content: lesson.content,
      difficulty_level: lesson.difficultyLevel,
      created_at: new Date().toISOString(),
    })),
  );

  const teacherContext = await getTeacherProgressContext(
    supabase,
    [parsedCourseId.data.courseId],
    lessons,
  );

  if (teacherContext.error) {
    return teacherContext;
  }

  const teacherData = teacherContext.data;

  if (!teacherData) {
    return { error: "Class progress could not be loaded." };
  }

  const progressMap = buildProgressMap(teacherData.progressRows);
  const students = teacherData.students;

  const studentAnalytics = students.map((student, index) => {
    const completionPercentage =
      lessons.length === 0
        ? 0
        : roundMetric(
            lessons.reduce((sum, lesson) => {
              return (
                sum +
                getProgressValue(progressMap, student.id, lesson.id, "completion_percentage")
              );
            }, 0) / lessons.length,
          );

    const masteryScore =
      lessons.length === 0
        ? 0
        : roundMetric(
            lessons.reduce((sum, lesson) => {
              return sum + getProgressValue(progressMap, student.id, lesson.id, "mastery_score");
            }, 0) / lessons.length,
          );

    const completedLessons = lessons.filter((lesson) => {
      return getProgressValue(progressMap, student.id, lesson.id, "completion_percentage") >= 100;
    }).length;

    const activeLessons = lessons.filter((lesson) => {
      return getProgressValue(progressMap, student.id, lesson.id, "completion_percentage") > 0;
    }).length;

    return {
      studentId: student.id,
      displayName: `Learner ${String(index + 1).padStart(2, "0")}`,
      gradeLevel: student.grade_level ?? "Not set",
      completionPercentage,
      masteryScore,
      completedLessons,
      activeLessons,
    };
  });

  const lessonAnalytics = lessons.map((lesson) => {
    const totalStudents = Math.max(students.length, 1);

    return {
      lessonId: lesson.id,
      title: lesson.title,
      difficultyLevel: lesson.difficulty_level ?? "Core",
      averageCompletionPercentage:
        students.length === 0
          ? 0
          : roundMetric(
              students.reduce((sum, student) => {
                return (
                  sum +
                  getProgressValue(progressMap, student.id, lesson.id, "completion_percentage")
                );
              }, 0) / totalStudents,
            ),
      averageMasteryScore:
        students.length === 0
          ? 0
          : roundMetric(
              students.reduce((sum, student) => {
                return sum + getProgressValue(progressMap, student.id, lesson.id, "mastery_score");
              }, 0) / totalStudents,
            ),
    };
  });

  const totalStudents = studentAnalytics.length;
  const averageCompletionPercentage =
    totalStudents === 0
      ? 0
      : roundMetric(
          studentAnalytics.reduce((sum, student) => sum + student.completionPercentage, 0) /
            totalStudents,
        );
  const averageMasteryScore =
    totalStudents === 0
      ? 0
      : roundMetric(
          studentAnalytics.reduce((sum, student) => sum + student.masteryScore, 0) / totalStudents,
        );
  const studentsNeedingAttention = studentAnalytics.filter((student) => {
    return student.completionPercentage < 50 || student.masteryScore < 60;
  }).length;

  return {
    data: teacherCourseAnalyticsSchema.parse({
      courseId: courseResult.data.course.id,
      title: courseResult.data.course.title,
      totalStudents,
      totalLessons: lessons.length,
      averageCompletionPercentage,
      averageMasteryScore,
      studentsNeedingAttention,
      students: studentAnalytics,
      lessons: lessonAnalytics,
    }),
  };
}

export async function recordProgressForViewer(
  supabase: SupabaseClient,
  input: RecordProgressInput,
): Promise<ServiceResult<{ courseId: string; message: string }>> {
  const parsedInput = recordProgressInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return { error: parsedInput.error.issues[0]?.message ?? "Invalid progress input." };
  }

  const viewerResult = await getViewerContext(supabase);

  if (viewerResult.error) {
    return viewerResult;
  }

  const viewer = viewerResult.data;

  if (!viewer) {
    return { error: "Your account context could not be resolved." };
  }

  const { role, studentId } = viewer;

  if (role !== "student" || !studentId) {
    return { error: "Only students can record progress right now." };
  }

  const lessonResponse = await supabase
    .from("lessons")
    .select("id, course_id, title, content, difficulty_level, created_at")
    .eq("id", parsedInput.data.lessonId)
    .maybeSingle();

  if (lessonResponse.error || !lessonResponse.data) {
    return { error: "That lesson could not be found." };
  }

  const lesson = lessonSchema.parse(lessonResponse.data);

  if (lesson.course_id !== parsedInput.data.courseId) {
    return { error: "The selected lesson does not belong to that course." };
  }

  const progressResponse = await supabase.from("progress_tracking").upsert(
    {
      student_id: studentId,
      lesson_id: parsedInput.data.lessonId,
      completion_percentage: parsedInput.data.completionPercentage,
      mastery_score: parsedInput.data.masteryScore,
      last_accessed: new Date().toISOString(),
    },
    {
      onConflict: "student_id,lesson_id",
    },
  );

  if (progressResponse.error) {
    return { error: "Progress could not be saved." };
  }

  const pathSyncResult = await syncLearningPathForStudent(supabase, {
    studentId,
    courseId: parsedInput.data.courseId,
    lessonId: parsedInput.data.lessonId,
    completionPercentage: parsedInput.data.completionPercentage,
  });

  if (pathSyncResult.error) {
    return { error: pathSyncResult.error };
  }

  return {
    data: {
      courseId: parsedInput.data.courseId,
      message:
        pathSyncResult.data?.currentLessonId && pathSyncResult.data.currentLessonId !== parsedInput.data.lessonId
          ? "Progress saved. Your learning path has moved to the next lesson."
          : "Progress saved.",
    },
  };
}















