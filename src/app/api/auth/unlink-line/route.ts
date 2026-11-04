import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { unlinkLine } from "@/services/account";

export async function POST() {
  return handle(async () => {
    await unlinkLine(await requireApiUser());
    return { ok: true };
  });
}
