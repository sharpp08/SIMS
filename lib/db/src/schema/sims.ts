import { createInsertSchema } from "drizzle-zod";
import {
  date,
  integer,
  boolean,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "TEACHER", "STUDENT"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "ACTIVE",
  "INACTIVE",
  "GRADUATED",
  "ON_LEAVE",
]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
]);
export const behaviorTypeEnum = pgEnum("behavior_type", [
  "NOTE",
  "WARNING",
  "ACHIEVEMENT",
]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "ATTENDANCE",
  "GRADE",
  "BEHAVIOR",
  "SYSTEM",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default("STUDENT"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  studentId: text("student_id").notNull().unique(),
  name: text("name").notNull(),
  dob: date("dob", { mode: "string" }).notNull(),
  gradeLevel: text("grade_level").notNull(),
  status: enrollmentStatusEnum("status").notNull().default("ACTIVE"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  emergencyContactName: text("emergency_contact_name").notNull(),
  emergencyContactPhone: text("emergency_contact_phone").notNull(),
  avatarUrl: text("avatar_url"),
  homeroom: text("homeroom"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentClassesTable = pgTable(
  "student_classes",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    className: text("class_name").notNull(),
    teacherId: integer("teacher_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
  },
  (table) => [unique().on(table.studentId, table.className)],
);

export const attendanceTable = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: attendanceStatusEnum("status").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.studentId, table.date)],
);

export const gradesTable = pgTable("grades", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  score: real("score").notNull(),
  maxScore: real("max_score").notNull(),
  term: text("term").notNull(),
  teacherId: integer("teacher_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const behaviorLogsTable = pgTable("behavior_logs", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  type: behaviorTypeEnum("type").notNull(),
  note: text("note").notNull(),
  authorId: integer("author_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  kind: notificationKindEnum("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
});
export const insertStudentClassSchema = createInsertSchema(studentClassesTable).omit({
  id: true,
});
export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  id: true,
  createdAt: true,
});
export const insertGradeSchema = createInsertSchema(gradesTable).omit({ id: true });
export const insertBehaviorLogSchema = createInsertSchema(behaviorLogsTable).omit({
  id: true,
  createdAt: true,
});
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Student = typeof studentsTable.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type StudentClass = typeof studentClassesTable.$inferSelect;
export type Attendance = typeof attendanceTable.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Grade = typeof gradesTable.$inferSelect;
export type InsertGrade = z.infer<typeof insertGradeSchema>;
export type BehaviorLog = typeof behaviorLogsTable.$inferSelect;
export type InsertBehaviorLog = z.infer<typeof insertBehaviorLogSchema>;
export type Notification = typeof notificationsTable.$inferSelect;