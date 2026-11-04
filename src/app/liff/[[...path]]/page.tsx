import { lineEnv } from "@/lib/line/config";
import { safeNext } from "@/lib/safe-next";
import { LiffEntry } from "./LiffEntry";

export const metadata = { title: "เปิดใน LINE" };

export default async function LiffPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("liff.") || k === "code" || k === "state" || typeof v !== "string") continue;
    qs.set(k, v);
  }
  const raw = `/${(path ?? []).map(encodeURIComponent).join("/")}${qs.size ? `?${qs}` : ""}`;
  return <LiffEntry liffId={lineEnv.liffId()} target={safeNext(raw)} />;
}
