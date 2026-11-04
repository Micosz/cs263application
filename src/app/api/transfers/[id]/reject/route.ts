import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { rejectTransfer } from "@/services/commands";
import { safeNotify } from "@/services/notify";

/** B ปฏิเสธพร้อมเหตุผล — ผู้รับผิดชอบคงเดิม */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await params;
    const { alreadyDone, request } = await rejectTransfer(user, id, await readJson(req));
    const notification = alreadyDone ? null : await safeNotify(request.id, "transfer_rejected", new URL(req.url).origin);
    return { alreadyDone, status: request.status, notification: notification?.status ?? null };
  });
}
