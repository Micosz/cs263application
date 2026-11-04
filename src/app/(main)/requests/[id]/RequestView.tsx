"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Thumb, typeImg } from "@/components/bits";
import { Sheet, usePost, useRefresh } from "@/components/client";
import { Icon } from "@/components/Icon";

type P = { id: string; fullName: string; avatarBg: string; avatarFg: string };

export type RequestViewProps = {
  role: "recipient" | "sender" | "viewer";
  me: P;
  req: {
    id: string;
    status: "pending" | "accepted" | "rejected" | "cancelled";
    reason: string;
    responseReason: string | null;
    createdAtText: string;
    respondedAtText: string | null;
    from: P;
    to: P & { hasLine: boolean };
    fromRoomCode: string;
    toRoomCode: string | null;
    currentRoomCode: string;
    asset: { id: string; code: string; name: string; type: string; custodianId: string };
    notification: { status: string; error: string | null } | null;
  };
};

const REASONS = ["ห้องไม่มีที่วาง", "ไม่ได้ใช้เครื่องนี้", "ส่งผิดคน", "ยังไม่ได้รับเครื่อง"];
const first = (s: string) => s.split(" ")[0] ?? s;

export function RequestView({ role, me, req }: RequestViewProps) {
  const refresh = useRefresh();
  const [sheet, setSheet] = useState<"accept" | "reject" | "cancel" | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [lineSent, setLineSent] = useState(false);
  const [touched, setTouched] = useState(false);
  const act = usePost<{ alreadyDone: boolean; status: string; notification: string | null }>();
  const resend = usePost<{ status: string; error: string | null }>();
  const [resendResult, setResendResult] = useState<{ status: string; error: string | null } | null>(null);

  const from = first(req.from.fullName);
  const to = first(req.to.fullName);
  const newRoom = req.toRoomCode ?? req.fromRoomCode;

  async function accept() {
    const r = await act.run(`/api/transfers/${req.id}/accept`);
    if (r) {
      setSheet(null);
      setLineSent(r.notification === "sent");
      setDone("accepted");
      refresh();
    } else refresh();
  }
  async function reject() {
    setTouched(true);
    if (!reason.trim()) return;
    const r = await act.run(`/api/transfers/${req.id}/reject`, { reason });
    if (r) {
      setSheet(null);
      setLineSent(r.notification === "sent");
      setDone("rejected");
      refresh();
    } else refresh();
  }
  async function cancel() {
    const r = await act.run(`/api/transfers/${req.id}/cancel`);
    if (r) {
      setSheet(null);
      refresh();
    }
  }
  async function doResend() {
    const r = await resend.run(`/api/transfers/${req.id}/notify`);
    if (r) {
      setResendResult(r);
      refresh();
    }
  }

  const errorBox = act.error ? (
    <div className="alert err" role="alert" style={{ margin: "12px 0 0" }}>
      <Icon name="warning" size={19} color="#C3002F" />
      <span>
        <strong>{act.error.code === "already_answered" ? "คำขอถูกตอบแล้ว" : act.error.status === 403 ? "ไม่ใช่ผู้รับที่ระบุ" : "ทำรายการไม่สำเร็จ"}</strong>
        {act.error.error}
      </span>
    </div>
  ) : null;

  /* ---------- หลังตอบ ---------- */
  if (done) {
    const acc = done === "accepted";
    return (
      <>
        <div className="content narrow">
          <div className="done" role="status">
            <h2>
              <Icon name="check" size={26} stroke={2.8} color="#2F7A3A" />
              {acc ? "คุณรับเครื่องนี้แล้ว" : "ส่งคำตอบแล้ว"}
            </h2>
            <p>
              {acc
                ? `ครุภัณฑ์อยู่ในของคุณแล้ว${lineSent ? ` และระบบแจ้ง${from}ทาง LINE แล้ว` : ` ${from}จะเห็นผลในหน้าคำขอบนเว็บ`}`
                : `${from}จะเห็นเหตุผล “${reason.trim()}” ${lineSent ? "ทาง LINE" : "ในหน้าคำขอบนเว็บ"}`}
            </p>
            <div className="card" style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
              <Thumb type={req.asset.type} size={52} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 15.5, fontWeight: 600, overflowWrap: "anywhere" }}>{req.asset.name}</span>
                <span className="meta">{acc ? `คุณดูแล อยู่ห้อง ${newRoom}` : `ยังอยู่กับ${from} ห้อง ${req.fromRoomCode}`}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="actionbar">
          <Link href="/requests" className="btn secondary">กลับไปคำขอ</Link>
          <Link href={acc ? `/assets/${req.asset.id}` : "/"} className="btn">{acc ? "ดูครุภัณฑ์" : "กลับหน้าหลัก"}</Link>
        </div>
      </>
    );
  }

  const assetCard = (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ height: 128, background: "var(--thumb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={typeImg(req.asset.type)} alt="" width={116} height={116} />
      </div>
      <Link href={`/assets/${req.asset.id}`} style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 3, color: "inherit", textDecoration: "none" }}>
        <span style={{ fontSize: 18, fontWeight: 700, overflowWrap: "anywhere" }}>{req.asset.name}</span>
        <span className="mono" style={{ fontSize: 12.5 }}>{req.asset.code}</span>
        <span style={{ fontSize: 14 }} className="muted">ตอนนี้อยู่ห้อง {req.currentRoomCode}</span>
      </Link>
    </div>
  );

  const senderCard = (
    <div className="card pad16">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar person={req.from} size={40} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.4, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{req.from.id === me.id ? "คุณ" : req.from.fullName}</span>
          <span style={{ fontSize: 13.5 }} className="muted">
            ขอส่งต่อให้{req.to.id === me.id ? "คุณ" : req.to.fullName} {req.createdAtText}
          </span>
        </div>
      </div>
      <p className="quote" style={{ marginTop: 12 }}>“{req.reason}”</p>
    </div>
  );

  const pending = req.status === "pending";

  return (
    <>
      <div className="content narrow" style={{ padding: "12px 16px 0" }}>
        <div className="desk-2" style={{ gap: "0 16px" }}>
          <div>
            {senderCard}
            {assetCard}
          </div>
          <div>
            {pending ? (
              <div className="card" style={{ marginTop: 12 }}>
                <p style={{ padding: "12px 16px 4px", fontSize: 13.5 }} className="muted">
                  {role === "recipient" ? "ถ้าคุณรับ" : `เมื่อ${to}กดรับ`}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                  <span style={{ width: 64, fontSize: 14.5 }} className="muted">ผู้ดูแล</span>
                  <Avatar person={req.to} size={28} />
                  <span style={{ fontSize: 15.5, fontWeight: 600 }}>{req.to.id === me.id ? "คุณ" : to}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                  <span style={{ width: 64, fontSize: 14.5 }} className="muted">ห้อง</span>
                  <span style={{ fontSize: 15.5, fontWeight: 600 }}>{newRoom}</span>
                  <span style={{ fontSize: 14 }} className="muted">{req.toRoomCode ? `ย้ายมาจาก ${req.fromRoomCode}` : "เหมือนเดิม"}</span>
                </div>
              </div>
            ) : (
              <div className="card pad16" role="status" style={{ marginTop: 12 }}>
                {req.status === "accepted" ? (
                  <>
                    <span className="tone-ok" style={{ fontWeight: 700 }}>ตอบรับแล้ว</span>
                    <p style={{ marginTop: 4 }}>
                      {req.to.id === me.id ? "คุณ" : to}รับเมื่อ {req.respondedAtText} · ผู้ดูแลใหม่อยู่ห้อง {newRoom}
                    </p>
                  </>
                ) : req.status === "rejected" ? (
                  <>
                    <span className="tone-err" style={{ fontWeight: 700 }}>ปฏิเสธ</span>
                    <p style={{ marginTop: 4 }}>{req.to.id === me.id ? "คุณ" : to}ไม่รับ เพราะ{req.responseReason}</p>
                    <p className="meta" style={{ marginTop: 2 }}>ทุกอย่างคงเดิม เครื่องยังอยู่กับ{req.from.id === me.id ? "คุณ" : from}ที่ห้อง {req.fromRoomCode}</p>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 700 }}>ยกเลิกแล้ว</span>
                    <p style={{ marginTop: 4 }}>ผู้ส่งยกเลิกคำขอนี้เมื่อ {req.respondedAtText}</p>
                  </>
                )}
                <p className="meta" style={{ marginTop: 8 }}>คำขอนี้ไม่อยู่ในสถานะรอตอบรับแล้ว จึงตอบซ้ำไม่ได้</p>
              </div>
            )}

            {pending && role === "sender" ? (
              <div className={`alert ${req.notification?.status === "sent" ? "" : "warn"}`} style={{ margin: "12px 0 0" }}>
                <Icon name={req.notification?.status === "sent" ? "chat" : "warning"} size={19} color={req.notification?.status === "sent" ? "#55555F" : "#9A3F00"} />
                <span>
                  {req.notification?.status === "sent" ? (
                    <><strong className="tone-info">รอ{to}กดรับ</strong>แจ้ง{to}ทาง LINE แล้ว</>
                  ) : (
                    <>
                      <strong>{!req.to.hasLine ? "ผู้รับยังไม่เชื่อม LINE" : "ส่งแจ้งเตือน LINE ไม่สำเร็จ"}</strong>
                      บันทึกคำขอแล้ว ผู้รับยังเห็นคำขอในเมนูคำขอบนเว็บ
                      {req.notification?.error ? <span className="meta" style={{ display: "block" }}>สาเหตุ: {req.notification.error}</span> : null}
                      {resendResult && resendResult.status !== "sent" ? <span className="meta" style={{ display: "block" }}>ลองส่งอีกครั้งแล้ว ยังไม่สำเร็จ</span> : null}
                    </>
                  )}
                </span>
              </div>
            ) : null}
            {resend.error ? <p className="field-error" role="alert" style={{ marginTop: 8 }}>{resend.error.error}</p> : null}
            {errorBox}
          </div>
        </div>
      </div>

      {pending && role === "recipient" ? (
        <div className="actionbar">
          <button type="button" className="btn secondary" onClick={() => { act.setError(null); setSheet("reject"); }}>ไม่รับ</button>
          <button type="button" className="btn" onClick={() => { act.setError(null); setSheet("accept"); }}>รับเครื่องนี้</button>
        </div>
      ) : pending && role === "sender" ? (
        <div className="actionbar">
          <button type="button" className="btn secondary" onClick={() => setSheet("cancel")}>ยกเลิกคำขอ</button>
          {req.notification?.status !== "sent" ? (
            <button type="button" className="btn" onClick={doResend} disabled={resend.pending}>
              {resend.pending ? "กำลังส่ง…" : "ส่งแจ้งเตือนอีกครั้ง"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="actionbar">
          <Link href="/requests" className="btn secondary">กลับไปคำขอ</Link>
          <Link href={`/assets/${req.asset.id}`} className="btn">ดูครุภัณฑ์</Link>
        </div>
      )}

      <Sheet open={sheet === "accept"} onClose={() => setSheet(null)} label="ยืนยันรับครุภัณฑ์">
        <h2>รับ{req.asset.name}?</h2>
        <p className="lead">คุณจะเป็นผู้ดูแลทันที และในระบบเครื่องจะอยู่ห้อง {newRoom} ควรกดรับเมื่อได้เครื่องมาแล้ว</p>
        {act.error ? <p className="field-error" role="alert">{act.error.error}</p> : null}
        <button type="button" className="btn" onClick={accept} disabled={act.pending} aria-busy={act.pending}>
          {act.pending ? "กำลังบันทึก…" : "ยืนยัน รับเครื่องนี้"}
        </button>
        <button type="button" className="btn secondary" onClick={() => setSheet(null)}>ยังไม่รับ</button>
      </Sheet>

      <Sheet open={sheet === "reject"} onClose={() => setSheet(null)} label="ปฏิเสธคำขอ">
        <h2>บอก{from}ว่าทำไมไม่รับ</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "2px 0" }}>
          {REASONS.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => setReason(r)} style={{ fontSize: 15 }}>
              {r}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="sr-only">เหตุผล</span>
          <textarea
            className="textarea"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={touched && !reason.trim()}
            style={{ minHeight: 52 }}
          />
        </label>
        {touched && !reason.trim() ? <p className="field-error">กรุณาระบุเหตุผลก่อนดำเนินการต่อ</p> : null}
        {act.error ? <p className="field-error" role="alert">{act.error.error}</p> : null}
        <button type="button" className="btn" onClick={reject} disabled={act.pending} aria-busy={act.pending}>
          {act.pending ? "กำลังส่ง…" : "ส่งคำตอบ"}
        </button>
        <button type="button" className="btn secondary" onClick={() => setSheet(null)}>ยกเลิก</button>
      </Sheet>

      <Sheet open={sheet === "cancel"} onClose={() => setSheet(null)} label="ยกเลิกคำขอส่งต่อ">
        <h2>ยกเลิกคำขอส่งต่อ?</h2>
        <p className="lead">{to}จะตอบคำขอนี้ไม่ได้อีก ครุภัณฑ์ยังอยู่กับคุณที่ห้อง {req.fromRoomCode}</p>
        {act.error ? <p className="field-error" role="alert">{act.error.error}</p> : null}
        <button type="button" className="btn" onClick={cancel} disabled={act.pending}>
          {act.pending ? "กำลังยกเลิก…" : "ยืนยัน ยกเลิกคำขอ"}
        </button>
        <button type="button" className="btn secondary" onClick={() => setSheet(null)}>ไม่ยกเลิก</button>
      </Sheet>
    </>
  );
}
