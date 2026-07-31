import { env } from "cloudflare:workers";

type SessionPayload = { teacherName: string; expiresAt: number };
const runtime = env as unknown as Record<string, string | undefined>;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function signature(payload: string) {
  const secret = runtime.SESSION_SECRET ?? "desenvolvimento-local-conselho-em-foco";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

export function isValidAccessCode(value: string) {
  return value === (runtime.SCHOOL_ACCESS_CODE ?? "Conselho2026");
}

export async function createSessionToken(teacherName: string) {
  const payload = stringToBase64Url(JSON.stringify({ teacherName, expiresAt: Date.now() + 12 * 60 * 60 * 1000 } satisfies SessionPayload));
  return `${payload}.${await signature(payload)}`;
}

export async function readSession(request: Request): Promise<SessionPayload | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("cf_session="))?.slice(11);
  if (!token) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature || providedSignature !== await signature(payload)) return null;
  try {
    const parsed = JSON.parse(base64UrlToString(payload)) as SessionPayload;
    if (!parsed.teacherName || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch { return null; }
}
