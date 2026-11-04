import Link from "next/link";
import { StateCard } from "@/components/bits";
import { Icon } from "@/components/Icon";
import { safeNext } from "@/lib/safe-next";
import { getPendingLine } from "@/lib/session";
import { LinkForm } from "./LinkForm";

export const metadata = { title: "เชื่อมบัญชี" };

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const pending = await getPendingLine();
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <header className="topbar" style={{ height: 56 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.25, paddingLeft: 12 }}>
          <span style={{ fontSize: 15.5, fontWeight: 700 }}>เชื่อมบัญชี</span>
          <span style={{ fontSize: 12 }} className="muted">ระบบติดตามครุภัณฑ์</span>
        </div>
        <Link href="/login" className="icon-btn" aria-label="ปิด"><Icon name="close" stroke={2.2} /></Link>
      </header>
      <div className="content narrow" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {pending ? (
          <LinkForm lineName={pending.name} next={next} />
        ) : (
          <StateCard
            title="LINE นี้ยังไม่เชื่อมบัญชี"
            message="หมดเวลาเชื่อมบัญชี หรือยังไม่ได้เข้าสู่ระบบด้วย LINE กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง แล้วระบบจะพากลับมาหน้านี้"
            action={{ href: `/login?next=${encodeURIComponent(next)}`, label: "เข้าสู่ระบบด้วย LINE" }}
          />
        )}
      </div>
    </div>
  );
}
