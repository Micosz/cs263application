import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { handle, readJson } from "@/lib/api";
import { isDevLoginEnabled } from "@/lib/auth";
import { Errors } from "@/lib/errors";
import { startSession } from "@/lib/session";

/**
 * สลับเป็นผู้ใช้ตัวอย่าง — ใช้ได้เฉพาะ NODE_ENV=development (npm run dev) และตอนรัน test
 * บน Vercel/production build จะตอบ 404 เสมอ
 */
export async function POST(req: Request) {
  if (!isDevLoginEnabled()) return new NextResponse("Not Found", { status: 404 });
  return handle(async () => {
    const { username } = z.object({ username: z.string().min(1) }).parse(await readJson(req));
    const [u] = await getDb().select().from(users).where(eq(users.username, username));
    if (!u || !u.active) throw Errors.notFound("ไม่พบผู้ใช้ตัวอย่างนี้");
    await startSession(u.id, "dev");
    return { ok: true, fullName: u.fullName };
  });
}
