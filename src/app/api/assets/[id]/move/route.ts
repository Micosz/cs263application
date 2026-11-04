import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { moveRoom } from "@/services/commands";

/** ย้ายห้อง (ผู้รับผิดชอบยืนยันแล้วมีผลทันที) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await params;
    const body = (await readJson(req)) as Record<string, unknown>;
    return moveRoom(user, { ...body, assetId: id });
  });
}
