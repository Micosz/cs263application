"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet, usePost } from "@/components/client";
import { Icon } from "@/components/Icon";

export function Prefs({ notifyReview, notifyResult }: { notifyReview: boolean; notifyResult: boolean }) {
  const [p, setP] = useState({ notifyReview, notifyResult });
  const post = usePost<{ notifyReview: boolean; notifyResult: boolean }>();
  async function flip(key: "notifyReview" | "notifyResult") {
    const next = { ...p, [key]: !p[key] };
    setP(next);
    const r = await post.run("/api/me/preferences", { [key]: next[key] });
    if (r) setP(r);
    else setP(p);
  }
  const rows = [
    { t: "มีคนส่งต่อครุภัณฑ์ให้ฉัน", on: true, locked: true, onClick: () => {} },
    { t: "เปิดรอบทบทวน และเตือนก่อนปิด 7 วัน", on: p.notifyReview, locked: false, onClick: () => flip("notifyReview") },
    { t: "ผู้รับตอบคำขอที่ฉันส่ง", on: p.notifyResult, locked: false, onClick: () => flip("notifyResult") },
  ];
  return (
    <div className="card">
      {rows.map((r) => (
        <div key={r.t} className="kv" style={{ minHeight: 60 }}>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
            <span style={{ fontSize: 15.5 }}>{r.t}</span>
            {r.locked ? <span style={{ fontSize: 13 }} className="muted">ปิดไม่ได้ เพราะต้องตอบให้ทัน</span> : null}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={r.on}
            aria-label={r.t}
            className="switch"
            disabled={r.locked || post.pending}
            onClick={r.onClick}
          >
            <span />
          </button>
        </div>
      ))}
      {post.error ? <p className="field-error" style={{ padding: "0 16px 12px" }}>{post.error.error}</p> : null}
    </div>
  );
}

export function LineManage({ lineName }: { lineName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const post = usePost();
  return (
    <>
      <button type="button" className="link-btn" style={{ color: "var(--muted)", fontWeight: 500 }} onClick={() => setOpen(true)}>
        จัดการ <Icon name="chevronRight" size={18} color="#6B6B75" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="จัดการการเชื่อม LINE">
        <h2>ยกเลิกการเชื่อม LINE?</h2>
        <p className="lead">
          บัญชี LINE “{lineName}” จะไม่ได้รับแจ้งเตือนอีก และจะเข้าสู่ระบบด้วย LINE นี้ไม่ได้จนกว่าจะเชื่อมใหม่ (ต้องขอรหัสเชื่อมบัญชีจากผู้ดูแลระบบ)
        </p>
        {post.error ? <p className="field-error">{post.error.error}</p> : null}
        <button
          type="button"
          className="btn"
          disabled={post.pending}
          onClick={async () => {
            if (await post.run("/api/auth/unlink-line")) {
              setOpen(false);
              router.refresh();
            }
          }}
        >
          ยกเลิกการเชื่อม
        </button>
        <button type="button" className="btn secondary" onClick={() => setOpen(false)}>ไม่ยกเลิก</button>
      </Sheet>
    </>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const post = usePost();
  return (
    <button
      type="button"
      className="kv"
      style={{ width: "100%", border: 0, background: "#fff", textAlign: "left", minHeight: 56 }}
      disabled={post.pending}
      onClick={async () => {
        await post.run("/api/auth/logout");
        router.replace("/login");
        router.refresh();
      }}
    >
      <span style={{ display: "flex" }}><Icon name="logout" color="#C3002F" /></span>
      <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>ออกจากระบบ</span>
    </button>
  );
}
