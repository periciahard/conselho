import { createSessionToken, isValidAccessCode, readSession } from "../../../lib/session";

export async function GET(request: Request) {
  const session = await readSession(request);
  return session ? Response.json({ teacherName: session.teacherName }) : Response.json({ error: "Não autenticado" }, { status: 401 });
}

export async function POST(request: Request) {
  const body = await request.json() as { teacherName?: string; accessCode?: string };
  const teacherName = body.teacherName?.trim().slice(0, 80) ?? "";
  if (teacherName.length < 3 || !isValidAccessCode(body.accessCode ?? "")) return Response.json({ error: "Nome ou código de acesso inválido." }, { status: 401 });
  const token = await createSessionToken(teacherName);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ teacherName }, { headers: { "set-cookie": `cf_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}` } });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "set-cookie": "cf_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" } });
}
