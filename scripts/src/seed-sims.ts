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

const firstNames = [
  "Avery",
  "Maya",
  "Theo",
  "Lina",
  "Ethan",
  "Sofia",
  "Noah",
  "Amara",
  "Caleb",
  "Leila",
  "Miles",
  "Nora",
  "Julian",
  "Zoe",
  "Mateo",
  "Iris",
  "Asher",
  "Chloe",
  "Dylan",
  "Elena",
];
const lastNames = [
  "Santos",
  "Reyes",
  "Cruz",
  "Navarro",
  "Bautista",
  "Dela Rosa",
  "Mendoza",
  "Garcia",
  "Villanueva",
  "Lim",
];
const additionalStudentNames = [
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
const studentNames = [
  ...firstNames.map((firstName, index) => `${firstName} ${lastNames[index % lastNames.length]}`),
  ...additionalStudentNames,
];
const subjects = ["Mathematics", "Science", "English", "World History"];
const teachers = [
  { name: "Marisol Chen", email: "marisol.chen@northstar.edu" },
  { name: "James Okafor", email: "james.okafor@northstar.edu" },
  { name: "Priya Nair", email: "priya.nair@northstar.edu" },
  { name: "Daniel Kim", email: "daniel.kim@northstar.edu" },
];
const classes = ["Algebra II", "Biology", "English Literature", "World History"];

function dateString(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function seed(): Promise<void> {
  await db.delete(notificationsTable);
  await db.delete(behaviorLogsTable);
  await db.delete(attendanceTable);
  await db.delete(gradesTable);
  await db.delete(studentClassesTable);
  await db.delete(studentsTable);
  await db.delete(usersTable);

  const [admin] = await db
    .insert(usersTable)
    .values({
      name: "Mr. Lhyan Conato",
      email: "lhyan.conato@northstar.edu",
      role: "ADMIN",
    })
    .returning();

  const teacherRows = await db
    .insert(usersTable)
    .values(teachers.map((teacher) => ({ ...teacher, role: "TEACHER" as const })))
    .returning();

  const studentUsers = await db
    .insert(usersTable)
    .values(
      studentNames.map((name) => ({
        name,
        email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")}@students.northstar.edu`,
        role: "STUDENT" as const,
      })),
    )
    .returning();

  const studentRows = await db
    .insert(studentsTable)
    .values(
      studentNames.map((name, index) => {
        const status: "ACTIVE" | "INACTIVE" | "GRADUATED" | "ON_LEAVE" =
          index === 17 ? "ON_LEAVE" : index === 18 ? "GRADUATED" : "ACTIVE";
        const grade = `${9 + (index % 4)}`;
        return {
          userId: studentUsers[index].id,
          studentId: `NS-${String(2026001 + index)}`,
          name,
          dob: `${2008 + (index % 3)}-${String((index % 9) + 1).padStart(2, "0")}-${String((index % 22) + 1).padStart(2, "0")}`,
          gradeLevel: grade,
          status,
          email: studentUsers[index].email,
          phone: `+63 917 ${String(100 + index).padStart(3, "0")} ${String(2000 + index)}`,
          emergencyContactName: `${lastNames[(index + 3) % lastNames.length]} Family`,
          emergencyContactPhone: `+63 917 ${String(500 + index).padStart(3, "0")} ${String(3000 + index)}`,
          homeroom: `${grade}-${String.fromCharCode(65 + (index % 3))}`,
        };
      }),
    )
    .returning();

  await db.insert(studentClassesTable).values(
    studentRows.flatMap((student, studentIndex) =>
      classes.map((className, classIndex) => ({
        studentId: student.id,
        className,
        teacherId: teacherRows[(studentIndex + classIndex) % teacherRows.length].id,
      })),
    ),
  );

  await db.insert(gradesTable).values(
    studentRows.flatMap((student, studentIndex) =>
      subjects.map((subject, subjectIndex) => {
        const base = 72 + ((studentIndex * 7 + subjectIndex * 5) % 25);
        return {
          studentId: student.id,
          subject,
          score: base,
          maxScore: 100,
          term: "Term 1",
          teacherId: teacherRows[(studentIndex + subjectIndex) % teacherRows.length].id,
        };
      }),
    ),
  );

  await db.insert(attendanceTable).values(
    studentRows.flatMap((student, studentIndex) =>
      Array.from({ length: 14 }, (_, dayIndex) => {
        const pattern = (studentIndex * 3 + dayIndex) % 17;
        const status =
          pattern === 0 || (studentIndex === 6 && dayIndex < 3)
            ? "ABSENT"
            : pattern === 1 || pattern === 8
              ? "LATE"
              : pattern === 2
                ? "EXCUSED"
                : "PRESENT";
        return {
          studentId: student.id,
          date: dateString(dayIndex + 1),
          status: status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
          notes:
            status === "ABSENT"
              ? studentIndex === 6
                ? "No notice received"
                : "Family reported illness"
              : status === "LATE"
                ? "Arrived after first bell"
                : null,
        };
      }),
    ),
  );

  await db.insert(behaviorLogsTable).values([
    {
      studentId: studentRows[1].id,
      type: "ACHIEVEMENT",
      note: "Led the robotics team to a regional finalist finish.",
      authorId: teacherRows[0].id,
    },
    {
      studentId: studentRows[6].id,
      type: "WARNING",
      note: "Three consecutive absences flagged for follow-up.",
      authorId: admin.id,
    },
    {
      studentId: studentRows[12].id,
      type: "NOTE",
      note: "Responding well to the new study plan.",
      authorId: teacherRows[2].id,
    },
    {
      studentId: studentRows[15].id,
      type: "ACHIEVEMENT",
      note: "Selected as a peer mentor for incoming students.",
      authorId: teacherRows[1].id,
    },
  ]);

  await db.insert(notificationsTable).values([
    {
      userId: admin.id,
      kind: "ATTENDANCE",
      message: `${studentRows[6].name} missed 3 consecutive days`,
      isRead: false,
    },
    {
      userId: admin.id,
      kind: "GRADE",
      message: `${studentRows[9].name}'s Science grade dropped below C-`,
      isRead: false,
    },
    {
      userId: admin.id,
      kind: "BEHAVIOR",
      message: "New achievement added to a student profile",
      isRead: true,
    },
    {
      userId: admin.id,
      kind: "SYSTEM",
      message: "Term 1 report cards are ready for review",
      isRead: true,
    },
  ]);

  console.log(
    `Seeded ${studentRows.length} students, ${studentRows.length * 14} attendance records, and ${studentRows.length * subjects.length} grades.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("@workspace/db");
    await pool.end();
  });