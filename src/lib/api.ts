import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "./errors";

/** ห่อ Route Handler ให้ตอบ error เป็น JSON ภาษาไทยเสมอ */
export async function handle(fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    return NextResponse.json(data ?? { ok: true });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "ข้อมูลไม่ครบ", code: "invalid" },
        { status: 400 },
      );
    }
    console.error(e);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ ลองอีกครั้ง", code: "server_error" },
      { status: 500 },
    );
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
