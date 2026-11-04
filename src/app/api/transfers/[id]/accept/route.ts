import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { acceptTransfer } from "@/services/commands";
import { safeNotify } from "@/services/notify";

/** B ตอบรับ (เฉพาะผู้รับที่ระบุ) — กดซ้ำได้ผลเดิม ไม่สร้างประวัติซ้ำ */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await params;
    const { alreadyDone, request } = await acceptTransfer(user, id);
    const notification = alreadyDone ? null : await safeNotify(request.id, "transfer_accepted", new URL(req.url).origin);
    return { alreadyDone, status: request.status, notification: notification?.status ?? null };
  });
}
