import { handle, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { clearPendingLine, getPendingLine, startSession } from "@/lib/session";
import { linkWithCode } from "@/services/account";

/** ผูก LINE ที่ยืนยันแล้ว (จาก cookie ชั่วคราว) กับบัญชีด้วยชื่อผู้ใช้ TU + รหัสเชื่อมบัญชี */
export async function POST(req: Request) {
  return handle(async () => {
    const pending = await getPendingLine();
    if (!pending) {
      throw new AppError(401, "expired", "หมดเวลาเชื่อมบัญชี กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง");
    }
    const r = await linkWithCode(pending, await readJson(req));
    if (!r.ok) throw r.error;
    await clearPendingLine();
    await startSession(r.user.id, pending.via);
    return { ok: true, fullName: r.user.fullName, lineName: pending.name };
  });
}
