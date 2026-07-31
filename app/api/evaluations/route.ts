import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { evaluations } from "../../../db/schema";
import { readSession } from "../../../lib/session";

const difficultyKeys = ["aprendizagem", "concentracao", "tempo", "emocional", "relacionamento", "saude", "disciplina", "assiduidade"] as const;

export async function GET(request: Request) {
  if (!await readSession(request)) return Response.json({ error: "Não autenticado" }, { status: 401 });
  try {
    return Response.json({ evaluations: await getDb().select().from(evaluations) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao consultar avaliações" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json() as { studentId?: string; priority?: boolean; difficulties?: string[]; notes?: string };
  const studentId = body.studentId?.trim() ?? "";
  if (!/^demo-[123][ab]-(adm|redes)$/.test(studentId) || typeof body.priority !== "boolean") return Response.json({ error: "Avaliação inválida" }, { status: 400 });
  const selected = new Set(Array.isArray(body.difficulties) ? body.difficulties : []);
  const values = {
    studentId,
    teacherName: session.teacherName,
    priority: body.priority ? 1 : 0,
    ...Object.fromEntries(difficultyKeys.map((key) => [key, body.priority && selected.has(key) ? 1 : 0])),
    notes: body.priority ? (body.notes?.trim().slice(0, 2000) ?? "") : "",
    updatedAt: new Date().toISOString(),
  } as typeof evaluations.$inferInsert;
  try {
    const db = getDb();
    const [existing] = await db.select({ id: evaluations.id }).from(evaluations).where(and(eq(evaluations.studentId, studentId), eq(evaluations.teacherName, session.teacherName))).limit(1);
    if (existing) await db.update(evaluations).set(values).where(eq(evaluations.id, existing.id));
    else await db.insert(evaluations).values(values);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao salvar avaliação" }, { status: 500 });
  }
}
