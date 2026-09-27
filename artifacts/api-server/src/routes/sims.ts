import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateStudentAttendanceBody,
  CreateStudentAttendanceParams,
  CreateStudentBehaviorBody,
  CreateStudentBehaviorParams,
  CreateStudentGradeBody,
  CreateStudentGradeParams,
  CreateStudentBody,
  CreateStudentResponse,
  CreateStudentAttendanceResponse,
  CreateStudentBehaviorResponse,
  CreateStudentGradeResponse,
  DeleteStudentParams,
  GetDashboardOverviewResponse,
  GetAttendanceTrendResponse,
  GetStudentParams,
  GetStudentResponse,
  UpdateGradeBody,
  ListNotificationsResponse,
  ListStudentAttendanceParams,
  ListStudentAttendanceResponse,
  ListStudentBehaviorParams,
  ListStudentBehaviorResponse,
  ListStudentGradesParams,
  ListStudentGradesResponse,
  ListStudentsQueryParams,
  ListStudentsResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  UpdateAttendanceBody,
  UpdateAttendanceParams,
  UpdateAttendanceResponse,
  UpdateGradeParams,
  UpdateGradeResponse,
  UpdateStudentBody,
  UpdateStudentParams,
  UpdateStudentResponse,
} from "@workspace/api-zod";
import {
  attendanceTable,
  behaviorLogsTable,
  db,
  gradesTable,
  notificationsTable,
  studentClassesTable,
  studentsTable,
  usersTable,
} from "@workspace/db";

const router: IRouter = Router();

const badRequest = (res: Parameters<Parameters<IRouter["get"]>[1]>[1], message: string) =>
  res.status(400).json({ error: message });

const notFound = (res: Parameters<Parameters<IRouter["get"]>[1]>[1], message: string) =>
  res.status(404).json({ error: message });

function calendarDate(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

async function getStudentMetrics(studentId: number): Promise<{ gpa: number; attendanceRate: number }> {
  const [gradeSummary] = await db
    .select({
      score: sql<number>`coalesce(sum(${gradesTable.score}), 0)`,
      maxScore: sql<number>`coalesce(sum(${gradesTable.maxScore}), 0)`,
    })
    .from(gradesTable)
    .where(eq(gradesTable.studentId, studentId));
  const [attendanceSummary] = await db
    .select({
      total: count(attendanceTable.id),
      attended: sql<number>`coalesce(sum(case when ${attendanceTable.status} in ('PRESENT', 'LATE', 'EXCUSED') then 1 else 0 end), 0)`,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.studentId, studentId));

  const maxScore = Number(gradeSummary?.maxScore ?? 0);
  const totalAttendance = Number(attendanceSummary?.total ?? 0);
  return {
    gpa: maxScore ? Number(((Number(gradeSummary?.score ?? 0) / maxScore) * 4).toFixed(2)) : 0,
    attendanceRate: totalAttendance
      ? Number(((Number(attendanceSummary?.attended ?? 0) / totalAttendance) * 100).toFixed(1))
      : 0,
  };
}

async function shapeStudent(student: typeof studentsTable.$inferSelect) {
  return { ...student, ...(await getStudentMetrics(student.id)) };
}

async function getAdminId(): Promise<number | null> {
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "ADMIN"))
    .limit(1);
  return admin?.id ?? null;
}

router.get("/dashboard/overview", async (_req, res): Promise<void> => {
  const students = await db.select().from(studentsTable);
  const shaped = await Promise.all(students.map(shapeStudent));
  const activeStudents = shaped.filter((student) => student.status === "ACTIVE");
  const averageGpa = shaped.length
    ? Number((shaped.reduce((sum, student) => sum + student.gpa, 0) / shaped.length).toFixed(2))
    : 0;
  const attendanceRate = shaped.length
    ? Number(
        (shaped.reduce((sum, student) => sum + student.attendanceRate, 0) / shaped.length).toFixed(1),
      )
    : 0;
  const atRiskStudents = shaped.filter((student) => student.gpa < 2.4 || student.attendanceRate < 85);
  const alerts = await db
    .select({
      id: notificationsTable.id,
      message: notificationsTable.message,
      createdAt: notificationsTable.createdAt,
      kind: notificationsTable.kind,
      studentName: sql<string>`coalesce(split_part(${notificationsTable.message}, '''', 1), 'Student')`,
    })
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(5);

  const gradeCounts = ["A", "B", "C", "D/F"].map((label) => ({
    label,
    count: shaped.filter((student) =>
      label === "A"
        ? student.gpa >= 3.5
        : label === "B"
          ? student.gpa >= 3
          : label === "C"
            ? student.gpa >= 2
            : student.gpa < 2,
    ).length,
    color: label === "A" ? "#2563eb" : label === "B" ? "#14b8a6" : label === "C" ? "#f59e0b" : "#f97316",
  }));

  const data = {
    totalStudents: students.length,
    activeStudents: activeStudents.length,
    attendanceRate,
    averageGpa,
    atRiskCount: atRiskStudents.length,
    recentAlerts: alerts.map((alert) => ({
      id: alert.id,
      type: alert.kind === "ATTENDANCE" ? "ATTENDANCE" : alert.kind === "GRADE" ? "GRADE" : "BEHAVIOR",
      message: alert.message,
      studentName: alert.studentName || "Student",
      createdAt: alert.createdAt,
      severity: alert.kind === "SYSTEM" ? "INFO" : "WARNING",
    })),
    gradeDistribution: gradeCounts,
  };
  res.json(GetDashboardOverviewResponse.parse(data));
});

router.get("/dashboard/attendance-trend", async (_req, res): Promise<void> => {
  const points = await Promise.all(
    Array.from({ length: 7 }, async (_, index) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (7 - index));
      const dateValue = date.toISOString().slice(0, 10);
      const rows = await db
        .select({ status: attendanceTable.status })
        .from(attendanceTable)
        .where(eq(attendanceTable.date, dateValue));
      const present = rows.filter((row) => row.status === "PRESENT" || row.status === "EXCUSED").length;
      const absent = rows.filter((row) => row.status === "ABSENT").length;
      const late = rows.filter((row) => row.status === "LATE").length;
      return {
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        rate: rows.length ? Number(((present / rows.length) * 100).toFixed(1)) : 0,
        present,
        absent,
        late,
      };
    }),
  );
  res.json(GetAttendanceTrendResponse.parse(points));
});

router.get("/students", async (req, res): Promise<void> => {
  const parsed = ListStudentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }
  const { search, gradeLevel, status, page, pageSize } = parsed.data;
  const filters = [];
  if (search) {
    filters.push(
      or(
        ilike(studentsTable.name, `%${search}%`),
        ilike(studentsTable.studentId, `%${search}%`),
        ilike(studentsTable.email, `%${search}%`),
      ),
    );
  }
  if (gradeLevel) filters.push(eq(studentsTable.gradeLevel, gradeLevel));
  if (status) filters.push(eq(studentsTable.status, status));
  const where = filters.length ? and(...filters) : undefined;
  const rows = await db
    .select()
    .from(studentsTable)
    .where(where)
    .orderBy(asc(studentsTable.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: count() }).from(studentsTable).where(where);
  res.json(
    ListStudentsResponse.parse({
      items: await Promise.all(rows.map(shapeStudent)),
      total: Number(total),
      page,
      pageSize,
    }),
  );
});

router.post("/students", async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }
  const [student] = await db
    .insert(studentsTable)
    .values({ ...parsed.data, dob: calendarDate(parsed.data.dob) })
    .returning();
  res.status(201).json(CreateStudentResponse.parse(await shapeStudent(student)));
});

router.get("/students/:id", async (req, res): Promise<void> => {
  const params = GetStudentParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, params.data.id));
  if (!student) {
    notFound(res, "Student not found");
    return;
  }
  const [classes, recentAttendance, recentGrades, behavior] = await Promise.all([
    db
      .select({ className: studentClassesTable.className })
      .from(studentClassesTable)
      .where(eq(studentClassesTable.studentId, student.id))
      .orderBy(asc(studentClassesTable.className)),
    db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.studentId, student.id))
      .orderBy(desc(attendanceTable.date))
      .limit(14),
    db
      .select({
        id: gradesTable.id,
        studentId: gradesTable.studentId,
        subject: gradesTable.subject,
        score: gradesTable.score,
        maxScore: gradesTable.maxScore,
        term: gradesTable.term,
        teacherName: sql<string>`coalesce(${usersTable.name}, 'Unassigned')`,
        updatedAt: gradesTable.updatedAt,
      })
      .from(gradesTable)
      .leftJoin(usersTable, eq(gradesTable.teacherId, usersTable.id))
      .where(eq(gradesTable.studentId, student.id))
      .orderBy(desc(gradesTable.updatedAt)),
    db.select({ total: count() }).from(behaviorLogsTable).where(eq(behaviorLogsTable.studentId, student.id)),
  ]);
  res.json(
    GetStudentResponse.parse({
      ...(await shapeStudent(student)),
      classes: classes.map((item) => item.className),
      recentAttendance,
      recentGrades,
      behaviorCount: Number(behavior[0]?.total ?? 0),
    }),
  );
});

router.patch("/students/:id", async (req, res): Promise<void> => {
  const params = UpdateStudentParams.safeParse(req.params);
  const body = UpdateStudentBody.safeParse(req.body);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  if (!body.success) {
    badRequest(res, body.error.message);
    return;
  }
  const [student] = await db
    .update(studentsTable)
    .set({ ...body.data, dob: calendarDate(body.data.dob) })
    .where(eq(studentsTable.id, params.data.id))
    .returning();
  if (!student) {
    notFound(res, "Student not found");
    return;
  }
  res.json(UpdateStudentResponse.parse(await shapeStudent(student)));
});

router.delete("/students/:id", async (req, res): Promise<void> => {
  const params = DeleteStudentParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  await db.delete(studentsTable).where(eq(studentsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/students/:id/grades", async (req, res): Promise<void> => {
  const params = ListStudentGradesParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  const rows = await db
    .select({
      id: gradesTable.id,
      studentId: gradesTable.studentId,
      subject: gradesTable.subject,
      score: gradesTable.score,
      maxScore: gradesTable.maxScore,
      term: gradesTable.term,
      teacherName: sql<string>`coalesce(${usersTable.name}, 'Unassigned')`,
      updatedAt: gradesTable.updatedAt,
    })
    .from(gradesTable)
    .leftJoin(usersTable, eq(gradesTable.teacherId, usersTable.id))
    .where(eq(gradesTable.studentId, params.data.id))
    .orderBy(desc(gradesTable.updatedAt));
  res.json(ListStudentGradesResponse.parse(rows));
});

router.post("/students/:id/grades", async (req, res): Promise<void> => {
  const params = CreateStudentGradeParams.safeParse(req.params);
  const body = CreateStudentGradeBody.safeParse(req.body);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  if (!body.success) {
    badRequest(res, body.error.message);
    return;
  }
  const teacherId = await getAdminId();
  const [grade] = await db
    .insert(gradesTable)
    .values({ ...body.data, studentId: params.data.id, teacherId })
    .returning();
  res.status(201).json(
    CreateStudentGradeResponse.parse({
      ...grade,
      teacherName: "Jordan Williams",
    }),
  );
});

router.patch("/grades/:id", async (req, res): Promise<void> => {
  const params = UpdateGradeParams.safeParse(req.params);
  const body = UpdateGradeBody.safeParse(req.body);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  if (!body.success) {
    badRequest(res, body.error.message);
    return;
  }
  const [grade] = await db.update(gradesTable).set(body.data).where(eq(gradesTable.id, params.data.id)).returning();
  if (!grade) {
    notFound(res, "Grade not found");
    return;
  }
  res.json(UpdateGradeResponse.parse({ ...grade, teacherName: "Jordan Williams" }));
});

router.get("/students/:id/attendance", async (req, res): Promise<void> => {
  const params = ListStudentAttendanceParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  const rows = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.studentId, params.data.id))
    .orderBy(desc(attendanceTable.date));
  res.json(ListStudentAttendanceResponse.parse(rows));
});

router.post("/students/:id/attendance", async (req, res): Promise<void> => {
  const params = CreateStudentAttendanceParams.safeParse(req.params);
  const body = CreateStudentAttendanceBody.safeParse(req.body);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  if (!body.success) {
    badRequest(res, body.error.message);
    return;
  }
  const [attendance] = await db
    .insert(attendanceTable)
    .values({ ...body.data, date: calendarDate(body.data.date), studentId: params.data.id })
    .onConflictDoUpdate({
      target: [attendanceTable.studentId, attendanceTable.date],
      set: { status: body.data.status, notes: body.data.notes },
    })
    .returning();
  res.status(201).json(CreateStudentAttendanceResponse.parse(attendance));
});

router.patch("/attendance/:id", async (req, res): Promise<void> => {
  const params = UpdateAttendanceParams.safeParse(req.params);
  const body = UpdateAttendanceBody.safeParse(req.body);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  if (!body.success) {
    badRequest(res, body.error.message);
    return;
  }
  const [attendance] = await db
    .update(attendanceTable)
    .set({ ...body.data, date: calendarDate(body.data.date) })
    .where(eq(attendanceTable.id, params.data.id))
    .returning();
  if (!attendance) {
    notFound(res, "Attendance record not found");
    return;
  }
  res.json(UpdateAttendanceResponse.parse(attendance));
});

router.get("/students/:id/behavior", async (req, res): Promise<void> => {
  const params = ListStudentBehaviorParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  const rows = await db
    .select({
      id: behaviorLogsTable.id,
      studentId: behaviorLogsTable.studentId,
      type: behaviorLogsTable.type,
      note: behaviorLogsTable.note,
      createdAt: behaviorLogsTable.createdAt,
      authorName: sql<string>`coalesce(${usersTable.name}, 'School staff')`,
    })
    .from(behaviorLogsTable)
    .leftJoin(usersTable, eq(behaviorLogsTable.authorId, usersTable.id))
    .where(eq(behaviorLogsTable.studentId, params.data.id))
    .orderBy(desc(behaviorLogsTable.createdAt));
  res.json(ListStudentBehaviorResponse.parse(rows));
});

router.post("/students/:id/behavior", async (req, res): Promise<void> => {
  const params = CreateStudentBehaviorParams.safeParse(req.params);
  const body = CreateStudentBehaviorBody.safeParse(req.body);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  if (!body.success) {
    badRequest(res, body.error.message);
    return;
  }
  const authorId = await getAdminId();
  const [behavior] = await db
    .insert(behaviorLogsTable)
    .values({ ...body.data, studentId: params.data.id, authorId })
    .returning();
  res.status(201).json(
    CreateStudentBehaviorResponse.parse({
      ...behavior,
      authorName: "Jordan Williams",
    }),
  );
});

router.get("/notifications", async (_req, res): Promise<void> => {
  const adminId = await getAdminId();
  const rows = adminId
    ? await db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.userId, adminId))
        .orderBy(desc(notificationsTable.createdAt))
    : [];
  res.json(ListNotificationsResponse.parse(rows));
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, params.data.id))
    .returning();
  if (!notification) {
    notFound(res, "Notification not found");
    return;
  }
  res.json(MarkNotificationReadResponse.parse(notification));
});

export default router;