import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { cancelTransfer } from "@/services/commands";

/** ผู้ส่งยกเลิกคำขอที่ยังรอตอบ */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await params;
    const { alreadyDone, request } = await cancelTransfer(user, id);
    return { alreadyDone, status: request.status };
  });
}
