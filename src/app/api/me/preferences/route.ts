import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { updatePrefs } from "@/services/account";

export async function POST(req: Request) {
  return handle(async () => updatePrefs(await requireApiUser(), await readJson(req)));
}
