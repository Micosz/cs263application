import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { AppError, Errors } from "@/lib/errors";

export const normalizeLinkCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const linkInput = z.object({
  username: z.string().trim().min(1, "กรอกชื่อผู้ใช้ TU").max(64),
  code: z.string().trim().min(4, "กรอกรหัสเชื่อมบัญชี").max(32),
});

const MAX_ATTEMPTS = 5;

export async function findUserByLineId(lineUserId: string) {
  const [u] = await getDb().select().from(users).where(eq(users.lineUserId, lineUserId));
  return u && u.active ? u : null;
}

/** ผูก LINE กับบัญชีที่ล็อกอินอยู่แล้ว (เช่น เข้าจากเว็บแล้วกด "เชื่อม LINE" ที่หน้าบัญชี) */
export async function bindLine(user: User, line: { sub: string; name: string }) {
  const db = getDb();
  const [other] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.lineUserId, line.sub), ne(users.id, user.id)));
  if (other) {
    throw Errors.conflict("line_taken", "บัญชี LINE นี้เชื่อมกับผู้ใช้อื่นอยู่แล้ว ติดต่อผู้ดูแลระบบ");
  }
  const [u] = await db
    .update(users)
    .set({ lineUserId: line.sub, lineDisplayName: line.name, lineLinkedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  return u;
}

/**
 * ผูก LINE ที่ยืนยันกับ LINE แล้ว เข้ากับบัญชีในระบบด้วยชื่อผู้ใช้ TU + รหัสเชื่อมบัญชีแบบใช้ครั้งเดียว
 * (ระบบนี้ไม่ได้เชื่อมกับระบบรหัสผ่านของมหาวิทยาลัย จึงใช้รหัสที่ผู้ดูแลระบบออกให้แทน)
 */
export async function linkWithCode(line: { sub: string; name: string }, raw: unknown) {
  const input = linkInput.parse(raw);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [u] = await tx
      .select()
      .from(users)
      .where(eq(users.username, input.username.toLowerCase()))
      .for("update");
    const fail = () =>
      new AppError(400, "bad_code", "ชื่อผู้ใช้หรือรหัสเชื่อมบัญชีไม่ถูกต้อง ลองอีกครั้ง หรือติดต่อผู้ดูแลระบบ ห้อง 213");
    if (!u || !u.active) throw fail();
    if (u.linkFailedAttempts >= MAX_ATTEMPTS) {
      throw new AppError(429, "locked", "กรอกรหัสผิดหลายครั้ง กรุณาขอรหัสใหม่จากผู้ดูแลระบบ");
    }
    const ok =
      !!u.linkCodeHash &&
      !!u.linkCodeExpiresAt &&
      u.linkCodeExpiresAt > new Date() &&
      u.linkCodeHash === sha256(normalizeLinkCode(input.code));
    if (!ok) {
      await tx
        .update(users)
        .set({ linkFailedAttempts: u.linkFailedAttempts + 1 })
        .where(eq(users.id, u.id));
      // คืนผลแบบ commit (ไม่ throw ใน tx เพื่อให้นับครั้งที่ผิดได้)
      return { ok: false as const, error: fail() };
    }
    const [taken] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.lineUserId, line.sub), ne(users.id, u.id)));
    if (taken) {
      return {
        ok: false as const,
        error: Errors.conflict("line_taken", "บัญชี LINE นี้เชื่อมกับผู้ใช้อื่นอยู่แล้ว ติดต่อผู้ดูแลระบบ"),
      };
    }
    const [linked] = await tx
      .update(users)
      .set({
        lineUserId: line.sub,
        lineDisplayName: line.name,
        lineLinkedAt: new Date(),
        linkCodeHash: null,
        linkCodeExpiresAt: null,
        linkFailedAttempts: 0,
      })
      .where(eq(users.id, u.id))
      .returning();
    return { ok: true as const, user: linked };
  });
}

export async function unlinkLine(user: User) {
  await getDb()
    .update(users)
    .set({ lineUserId: null, lineDisplayName: null, lineLinkedAt: null })
    .where(eq(users.id, user.id));
}

export const prefsInput = z.object({
  notifyReview: z.boolean().optional(),
  notifyResult: z.boolean().optional(),
});

export async function updatePrefs(user: User, raw: unknown) {
  const p = prefsInput.parse(raw);
  const [u] = await getDb()
    .update(users)
    .set({
      notifyReview: p.notifyReview ?? user.notifyReview,
      notifyResult: p.notifyResult ?? user.notifyResult,
    })
    .where(eq(users.id, user.id))
    .returning();
  return { notifyReview: u.notifyReview, notifyResult: u.notifyResult };
}
