import { handle } from "@/lib/api";
import { endSession } from "@/lib/session";

export async function POST() {
  return handle(async () => {
    await endSession();
    return { ok: true };
  });
}
