"use client";

import Link from "next/link";
import { useState } from "react";
import { Thumb, typeImg } from "@/components/bits";
import { usePost, useRefresh } from "@/components/client";
import { Icon, type IconName } from "@/components/Icon";

type Item = { id: string; code: string; name: string; type: string; roomCode: string };
type Result = "ok" | "broken" | "missing";

const OPTS: { id: Result; label: string; icon: IconName; color: string }[] = [
  { id: "ok", label: "เจอ ใช้งานได้", icon: "check", color: "#2F7A3A" },
  { id: "broken", label: "เจอ แต่ชำรุด", icon: "wrench", color: "#A14A00" },
  { id: "missing", label: "ไม่เจอ", icon: "help", color: "#C3002F" },
];
const RES = { ok: ["เจอ ใช้งานได้", "tone-ok"], broken: ["ชำรุด", "tone-warn"], missing: ["ไม่เจอ", "tone-err"] } as const;

export function ReviewFlow({ items, totalMine, reviewedBefore }: { items: Item[]; totalMine: number; reviewedBefore: number }) {
  const refresh = useRefresh();
  const [idx, setIdx] = useState(0);
  const [ans, setAns] = useState<Record<number, Result>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState<Record<number, Result>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const post = usePost();

  const cur = items[idx];
  const a = ans[idx];
  const last = idx === items.length - 1;

  async function save() {
    if (!a || !cur) return;
    const r = await post.run("/api/reviews", { assetId: cur.id, result: a, note: notes[idx] ?? null });
    if (!r) return;
    setSaved((s) => ({ ...s, [idx]: a }));
    if (last) {
      setFinished(true);
      setToast(null);
      refresh();
    } else {
      setToast(cur.name);
      setIdx(idx + 1);
    }
  }

  if (finished) {
    const doneCount = reviewedBefore + Object.keys(saved).length;
    const anyMissing = Object.values(saved).includes("missing");
    return (
      <>
        <header className="topbar">
          <Link href="/mine" className="icon-btn" aria-label="ย้อนกลับ"><Icon name="back" stroke={2.2} /></Link>
          <h1>ทบทวนรอบนี้</h1>
        </header>
        <div className="content narrow">
          <div className="done" role="status">
            <h2><Icon name="check" size={26} stroke={2.8} color="#2F7A3A" />ทบทวนครบแล้ว</h2>
            <p>รอบนี้คุณทบทวนแล้ว {Math.min(doneCount, totalMine)} จาก {totalMine} รายการ ผู้ดูแลระบบเห็นผลแล้ว</p>
            <div className="card">
              {items.map((it, i) =>
                saved[i] ? (
                  <div key={it.id} className="item" style={{ minHeight: 56 }}>
                    <Thumb type={it.type} size={48} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, overflowWrap: "anywhere" }}>{it.name}</span>
                    <span className={`status ${RES[saved[i]][1]}`} style={{ fontSize: 14 }}>{RES[saved[i]][0]}</span>
                  </div>
                ) : null,
              )}
            </div>
            {anyMissing ? (
              <p className="note" style={{ marginTop: 12 }}><Icon name="info" size={18} />รายการที่ไม่เจอ ผู้ดูแลระบบจะเห็นในผลทบทวนเพื่อช่วยตาม</p>
            ) : null}
          </div>
        </div>
        <div className="actionbar">
          <Link href="/mine" className="btn secondary">ดูของฉัน</Link>
          <Link href="/" className="btn">กลับหน้าหลัก</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <Link href="/mine" className="icon-btn" aria-label="ย้อนกลับ"><Icon name="back" stroke={2.2} /></Link>
        <h1>ทบทวนรอบนี้</h1>
        <span style={{ fontSize: 14.5, fontWeight: 600 }} className="muted">{idx + 1} จาก {items.length}</span>
      </header>
      <div className="content narrow">
        <div aria-hidden="true" style={{ display: "flex", gap: 4, padding: "12px 16px 0" }}>
          {items.map((it, i) => (
            <span key={it.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < idx ? "#2F7A3A" : i === idx ? "#17171A" : "#DCDCE2" }} />
          ))}
        </div>
        <div style={{ padding: "12px 16px 0" }}>
          <div className="card">
            <div style={{ height: 150, background: "var(--thumb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={typeImg(cur.type)} alt="" width={132} height={132} />
            </div>
            <div style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, overflowWrap: "anywhere" }}>{cur.name}</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{cur.code}</span>
              <span style={{ fontSize: 14 }} className="muted">ในทะเบียนอยู่ห้อง {cur.roomCode}</span>
            </div>
          </div>
          <p style={{ margin: "18px 4px 10px", fontSize: 16.5, fontWeight: 600 }}>เจอเครื่องนี้ที่ห้อง {cur.roomCode} ไหม</p>
          <div role="radiogroup" aria-label="ผลการทบทวน" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {OPTS.map((o) => {
              const on = a === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => { setAns({ ...ans, [idx]: o.id }); setToast(null); }}
                  style={{
                    width: "100%", minHeight: 56, padding: "0 14px 0 16px", borderRadius: 12, background: "#fff",
                    fontSize: 16, display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                    border: on ? "2px solid #17171A" : "1px solid #D3D3DA", fontWeight: on ? 600 : 500,
                  }}
                >
                  <Icon name={o.icon} size={22} color={o.color} />
                  <span style={{ flex: 1 }}>{o.label}</span>
                  {on ? <Icon name="check" size={20} stroke={2.6} color="#17171A" /> : null}
                </button>
              );
            })}
          </div>
          {a === "broken" ? (
            <label className="field" style={{ marginTop: 10 }}>
              <span className="sr-only">อาการเสีย</span>
              <textarea
                className="textarea"
                placeholder="อาการเสีย เช่น จอไม่ติด (ไม่บังคับ)"
                value={notes[idx] ?? ""}
                maxLength={500}
                onChange={(e) => setNotes({ ...notes, [idx]: e.target.value })}
              />
            </label>
          ) : (
            <Link href={`/assets/${cur.id}/manage?mode=room`} className="btn secondary sm" style={{ marginTop: 10, width: "100%" }}>
              เจอ แต่อยู่ห้องอื่น
            </Link>
          )}
          {post.error ? <p className="field-error" role="alert" style={{ marginTop: 10 }}>{post.error.error}</p> : null}
        </div>
      </div>
      {toast && !a ? (
        <div role="status" className="toast">
          <span style={{ flex: 1 }}>บันทึก {toast} แล้ว</span>
          <button type="button" onClick={() => { setIdx(Math.max(0, idx - 1)); setToast(null); }}>แก้</button>
        </div>
      ) : null}
      <div className="actionbar">
        <button type="button" className="btn" onClick={save} disabled={!a || post.pending} aria-disabled={!a}>
          {post.pending ? "กำลังบันทึก…" : !a ? "เลือกผลก่อนบันทึก" : last ? "บันทึกรายการสุดท้าย" : "บันทึก แล้วไปเครื่องถัดไป"}
        </button>
      </div>
    </>
  );
}
