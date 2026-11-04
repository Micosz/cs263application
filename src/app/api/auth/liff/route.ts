import { z } from "zod";
import { handle, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { LineAuthError, verifyIdToken } from "@/lib/line/login";
import { completeLineLogin } from "@/lib/line-session";

const body = z.object({ idToken: z.string().min(20, "ไม่มี ID token จาก LIFF") });

/** LIFF ส่ง ID token มา → server ตรวจกับ LINE ก่อนสร้าง session */
export async function POST(req: Request) {
  return handle(async () => {
    const { idToken } = body.parse(await readJson(req));
    try {
      const identity = await verifyIdToken(idToken);
      return await completeLineLogin(identity, "liff");
    } catch (e) {
      if (e instanceof LineAuthError) throw new AppError(401, "line_failed", e.message);
      throw e;
    }
  });
}
