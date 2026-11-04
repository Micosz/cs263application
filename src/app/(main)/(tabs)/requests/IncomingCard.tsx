"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Thumb } from "@/components/bits";
import { Sheet, usePost } from "@/components/client";

export type IncomingProps = {
  id: string;
  from: { id: string; fullName: string; avatarBg: string; avatarFg: string };
  createdAtText: string;
  reason: string;
  asset: { name: string; code: string; type: string };
  fromRoomCode: string;
  toRoomCode: string | null;
};

/** การ์ด "รอคุณตอบ" — กดรับได้ทันทีจากหน้ารายการ (ยืนยันอีกชั้น) */
export function IncomingCard(r: IncomingProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const act = usePost();
  const room = r.toRoomCode ?? r.fromRoomCode;

  async function accept() {
    const res = await act.run(`/api/transfers/${r.id}/accept`);
    if (res) {
      setOpen(false);
      router.replace(`/requests?accepted=${r.id}`, { scroll: false });
      router.refresh();
    }
  }

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar person={r.from} size={40} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
          <span style={{ fontSize: 15.5, fontWeight: 600 }}>{r.from.fullName}</span>
          <span style={{ fontSize: 13, color: "var(--muted-2)" }}>{r.createdAtText}</span>
        </div>
        <Link href={`/requests/${r.id}`} className="link-btn">รายละเอียด</Link>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <Thumb type={r.asset.type} size={56} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{r.asset.name}</span>
          <span className="mono">{r.asset.code}</span>
          <span style={{ fontSize: 14 }} className="muted">
            {r.toRoomCode ? `ขอย้ายจากห้อง ${r.fromRoomCode} มาห้อง ${r.toRoomCode}` : `อยู่ห้อง ${r.fromRoomCode} เหมือนเดิม`}
          </span>
        </div>
      </div>
      <p className="quote" style={{ marginTop: 12 }}>“{r.reason}”</p>
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <Link href={`/requests/${r.id}`} className="btn secondary sm">ไม่รับ</Link>
        <button type="button" className="btn sm" onClick={() => { act.setError(null); setOpen(true); }}>รับเครื่องนี้</button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} label="ยืนยันรับครุภัณฑ์">
        <h2>รับ{r.asset.name}?</h2>
        <p className="lead">คุณจะเป็นผู้ดูแลทันที และในระบบเครื่องจะอยู่ห้อง {room} ควรกดรับเมื่อได้เครื่องมาแล้ว</p>
        {act.error ? <p className="field-error" role="alert">{act.error.error}</p> : null}
        <button type="button" className="btn" onClick={accept} disabled={act.pending}>
          {act.pending ? "กำลังบันทึก…" : "ยืนยัน รับเครื่องนี้"}
        </button>
        <button type="button" className="btn secondary" onClick={() => setOpen(false)}>ยังไม่รับ</button>
      </Sheet>
    </div>
  );
}
