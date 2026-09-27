import {
  db,
  notificationsTable,
  studentsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray, notInArray } from "drizzle-orm";

const retainedNames = [
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

async function removeOldStudents(): Promise<void> {
  const retained = new Set(retainedNames.map((name) => name.toUpperCase()));
  const students = await db.select({ id: studentsTable.id, name: studentsTable.name }).from(studentsTable);
  const oldIds = students
    .filter((student) => !retained.has(student.name.toUpperCase()))
    .map((student) => student.id);

  if (oldIds.length) {
    await db.delete(studentsTable).where(inArray(studentsTable.id, oldIds));
  }

  const retainedEmails = retainedNames.map(
    (name) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")}@students.northstar.edu`,
  );
  await db
    .delete(usersTable)
    .where(and(eq(usersTable.role, "STUDENT"), notInArray(usersTable.email, retainedEmails)));

  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "ADMIN"))
    .limit(1);
  await db.delete(notificationsTable);
  if (admin) {
    await db.insert(notificationsTable).values([
      {
        userId: admin.id,
        kind: "ATTENDANCE",
        message: `${retainedNames[6]} missed 3 consecutive days`,
        isRead: false,
      },
      {
        userId: admin.id,
        kind: "GRADE",
        message: `${retainedNames[9]}'s Science grade dropped below C-`,
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
  }

  console.log(`Removed ${oldIds.length} old students. Retained ${retainedNames.length} new students.`);
}

removeOldStudents()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("@workspace/db");
    await pool.end();
  });