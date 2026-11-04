import { handle, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { saveReview } from "@/services/commands";

export async function POST(req: Request) {
  return handle(async () => saveReview(await requireApiUser(), await readJson(req)));
}
