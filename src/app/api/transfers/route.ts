import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { fmtDateTime, requestCode } from "@/lib/format";
import { createTransfer } from "@/services/commands";
import { safeNotify } from "@/services/notify";

/** A ส่งคำขอส่งต่อให้ B → สถานะ "รอตอบรับ" แล้วแจ้ง B ทาง LINE */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser();
    const { duplicate, request } = await createTransfer(user, await readJson(req));
    // แจ้งเตือนหลังบันทึกคำขอแล้ว ถ้าส่งไม่ได้ คำขอยังอยู่และบันทึกผลการส่งไว้
    const notification = await safeNotify(request.id, "transfer_requested", new URL(req.url).origin);
    return {
      duplicate,
      request: {
        id: request.id,
        code: requestCode(request.seq, request.createdAt),
        createdAtText: fmtDateTime(request.createdAt),
        status: request.status,
      },
      notification: notification ? { status: notification.status, error: notification.error } : null,
    };
  });
}
