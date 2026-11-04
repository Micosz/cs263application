import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { bindLine, findUserByLineId } from "@/services/account";
import { getCurrentUser } from "./auth";
import type { LineIdentity } from "./line/login";
import { setPendingLine, startSession } from "./session";

export type LineLoginOutcome = { status: "ok" } | { status: "link" } | { status: "linked" };

/**
 * หลัง server ยืนยันตัวตนกับ LINE แล้ว:
 * - ล็อกอินอยู่แล้ว (กดเชื่อม LINE จากหน้าบัญชี) → ผูก LINE กับบัญชีนี้
 * - LINE นี้ผูกกับผู้ใช้แล้ว → สร้าง session
 * - ยังไม่ผูก → เก็บตัวตน LINE ชั่วคราว แล้วไปหน้าเชื่อมบัญชี
 */
export async function completeLineLogin(identity: LineIdentity, via: "line" | "liff"): Promise<LineLoginOutcome> {
  const current = await getCurrentUser();
  if (current) {
    if (current.lineUserId === identity.sub) return { status: "ok" };
    await bindLine(current, identity);
    return { status: "linked" };
  }
  const user = await findUserByLineId(identity.sub);
  if (user) {
    if (user.lineDisplayName !== identity.name) {
      await getDb().update(users).set({ lineDisplayName: identity.name }).where(eq(users.id, user.id));
    }
    await startSession(user.id, via);
    return { status: "ok" };
  }
  await setPendingLine({ sub: identity.sub, name: identity.name, via });
  return { status: "link" };
}
