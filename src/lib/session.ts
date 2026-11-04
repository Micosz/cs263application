import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { randomToken, sha256, signPayload, verifyPayload } from "./crypto";

export const SESSION_COOKIE = "asset_session";
const SESSION_DAYS = 30;

const cookieBase = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

/** สร้าง session ในฐานข้อมูลและตั้ง cookie (เรียกได้จาก Route Handler) */
export async function startSession(userId: string, via: "line" | "liff" | "dev") {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await getDb().insert(sessions).values({ id: sha256(token), userId, via, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    ...cookieBase(),
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb().delete(sessions).where(eq(sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function readSessionUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await getDb()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  return user && user.active ? user : null;
}

/* ---------- cookie ชั่วคราวที่เซ็นด้วย SESSION_SECRET ---------- */

const PENDING_LINE_COOKIE = "line_pending";
const OAUTH_COOKIE = "line_oauth";

export type PendingLine = { sub: string; name: string; via: "line" | "liff" };
export type OAuthState = { state: string; nonce: string; verifier: string; next: string };

/** ตัวตน LINE ที่ผ่านการตรวจแล้วแต่ยังไม่ได้ผูกกับบัญชี (รอกรอกรหัสเชื่อมบัญชี) */
export async function setPendingLine(p: PendingLine) {
  (await cookies()).set(PENDING_LINE_COOKIE, signPayload(p, 15 * 60), {
    ...cookieBase(),
    maxAge: 15 * 60,
  });
}
export async function getPendingLine() {
  return verifyPayload<PendingLine>((await cookies()).get(PENDING_LINE_COOKIE)?.value);
}
export async function clearPendingLine() {
  (await cookies()).delete(PENDING_LINE_COOKIE);
}

export async function setOAuthState(s: OAuthState) {
  (await cookies()).set(OAUTH_COOKIE, signPayload(s, 10 * 60), {
    ...cookieBase(),
    maxAge: 10 * 60,
  });
}
export async function takeOAuthState() {
  const jar = await cookies();
  const v = verifyPayload<OAuthState>(jar.get(OAUTH_COOKIE)?.value);
  jar.delete(OAUTH_COOKIE);
  return v;
}
