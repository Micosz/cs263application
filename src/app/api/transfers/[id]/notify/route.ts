import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { resendRequestNotification } from "@/services/notify";

/** ผู้ส่งกด "ส่งแจ้งเตือนอีกครั้ง" เมื่อครั้งก่อนส่ง LINE ไม่สำเร็จ */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await params;
    const n = await resendRequestNotification(user, id, new URL(req.url).origin);
    return { status: n.status, error: n.error };
  });
}
