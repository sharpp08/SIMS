import {
  attendanceTable,
  db,
  gradesTable,
  studentClassesTable,
  studentsTable,
  usersTable,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";

const names = [
  "ALOJIPAN",
  "AGARCIA",
  "OBISPO",
  "ATERAMBOLO",
  "BUCAD",
  "SAPIO",
  "UNIANA",
  "ABDULLAH",
  "QUANICO",
  "NEAR",
  "NAVIDAD",
  "BLANCIA",
  "CABRILLOS",
  "NACIONALES",
  "VEJARASCO",
  "ZAMORA",
  "GILLADO",
  "JABEZ",
  "SALAZAR",
  "CANJA",
  "EVANGELIO",
  "LABIOS",
  "DEL ROSARIO",
  "PAEZ",
  "AMENDOZA",
  "AGOBOY",
  "AERPILUA",
  "ACERNA",
  "SONGCOG",
  "PIDO",
  "CANJA, MARK",
  "OSTAN",
  "NOBLEZADA",
  "ALAGAO",
  "SUMANDE",
];
const subjects = ["Mathematics", "Science", "English", "World History"];
const classes = ["Algebra II", "Biology", "English Literature", "World History"];

function dateString(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}

async function addStudents(): Promise<void> {
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "ADMIN"))
    .orderBy(asc(usersTable.id))
    .limit(1);
  if (admin) {
    await db
      .update(usersTable)
      .set({ name: "Mr. Lhyan Conato" })
      .where(eq(usersTable.id, admin.id));
  }

  const existing = await db.select({ name: studentsTable.name }).from(studentsTable);
  const existingNames = new Set(existing.map((student) => student.name.toUpperCase()));
  const [teacherRows, lastStudent] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "TEACHER")).orderBy(asc(usersTable.id)),
    db.select({ studentId: studentsTable.studentId }).from(studentsTable).orderBy(asc(studentsTable.id)),
  ]);

  const nextNumber =
    lastStudent.reduce((max, student) => {
      const numericId = Number(student.studentId.replace("NS-", ""));
      return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
    }, 2026000) + 1;

  const newStudents: Array<typeof studentsTable.$inferSelect> = [];
  for (const [index, name] of names.entries()) {
    if (existingNames.has(name.toUpperCase())) continue;
    const email = `${slugify(name)}@students.northstar.edu`;
    const [user] = await db
      .insert(usersTable)
      .values({ name, email, role: "STUDENT" })
      .returning();
    const grade = `${9 + (index % 4)}`;
    const [student] = await db
      .insert(studentsTable)
      .values({
        userId: user.id,
        studentId: `NS-${String(nextNumber + newStudents.length)}`,
        name,
        dob: `${2008 + (index % 3)}-${String((index % 9) + 1).padStart(2, "0")}-${String((index % 22) + 1).padStart(2, "0")}`,
        gradeLevel: grade,
        status: "ACTIVE",
        email,
        phone: `+63 917 ${String(600 + index).padStart(3, "0")} ${String(4000 + index)}`,
        emergencyContactName: "Family contact",
        emergencyContactPhone: `+63 917 ${String(800 + index).padStart(3, "0")} ${String(5000 + index)}`,
        homeroom: `${grade}-${String.fromCharCode(65 + (index % 3))}`,
      })
      .returning();
    newStudents.push(student);
  }

  if (newStudents.length && teacherRows.length) {
    await db.insert(studentClassesTable).values(
      newStudents.flatMap((student, studentIndex) =>
        classes.map((className, classIndex) => ({
          studentId: student.id,
          className,
          teacherId: teacherRows[(studentIndex + classIndex) % teacherRows.length].id,
        })),
      ),
    );
    await db.insert(gradesTable).values(
      newStudents.flatMap((student, studentIndex) =>
        subjects.map((subject, subjectIndex) => ({
          studentId: student.id,
          subject,
          score: 74 + ((studentIndex * 7 + subjectIndex * 5) % 22),
          maxScore: 100,
          term: "Term 1",
          teacherId: teacherRows[(studentIndex + subjectIndex) % teacherRows.length].id,
        })),
      ),
    );
    await db.insert(attendanceTable).values(
      newStudents.flatMap((student, studentIndex) =>
        Array.from({ length: 14 }, (_, dayIndex) => ({
          studentId: student.id,
          date: dateString(dayIndex + 1),
          status: ((studentIndex + dayIndex) % 13 === 0 ? "LATE" : "PRESENT") as "PRESENT" | "LATE",
          notes: null,
        })),
      ),
    );
  }

  console.log(`Updated admin name and added ${newStudents.length} new students.`);
}

addStudents()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("@workspace/db");
    await pool.end();
  });