import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const evaluations = sqliteTable("evaluations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: text("student_id").notNull(),
  teacherName: text("teacher_name").notNull(),
  priority: integer("priority").notNull().default(0),
  aprendizagem: integer("aprendizagem").notNull().default(0),
  concentracao: integer("concentracao").notNull().default(0),
  tempo: integer("tempo").notNull().default(0),
  emocional: integer("emocional").notNull().default(0),
  relacionamento: integer("relacionamento").notNull().default(0),
  saude: integer("saude").notNull().default(0),
  disciplina: integer("disciplina").notNull().default(0),
  assiduidade: integer("assiduidade").notNull().default(0),
  notes: text("notes").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("evaluation_student_teacher_idx").on(table.studentId, table.teacherName)]);
