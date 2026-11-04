"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Thumb, TopBar } from "@/components/bits";
import { Sheet, useIdempotencyKey, usePost, useRefresh } from "@/components/client";
import { Icon } from "@/components/Icon";

type Person = { id: string; fullName: string; position: string; avatarBg: string; avatarFg: string; hasLine: boolean };
type RoomOpt = { id: number; code: string; name: string; n: number };
type Mode = "room" | "person" | "both";

export type ManageProps = {
  me: { id: string; fullName: string; avatarBg: string; avatarFg: string };
  asset: { id: string; code: string; name: string; type: string; roomId: number; roomCode: string };
  people: Person[];
  rooms: RoomOpt[];
  pending: { id: string; toName: string; createdAtText: string } | null;
  initialMode: Mode;
};

type TransferResult = {
  duplicate: boolean;
  request: { id: string; code: string; createdAtText: string };
  notification: { status: string; error: string | null } | null;
};

const first = (s: string) => s.split(" ")[0] ?? s;

export function ManageFlow(p: ManageProps) {
  const refresh = useRefresh();
  const key = useIdempotencyKey();
  const [mode, setMode] = useState<Mode>(p.initialMode);
  const [personId, setPersonId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [picker, setPicker] = useState<"person" | "room" | null>(null);
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [touched, setTouched] = useState(false);
  const [moved, setMoved] = useState<{ from: string; to: string } | null>(null);
  const [sent, setSent] = useState<TransferResult | null>(null);
  const [askCancel, setAskCancel] = useState(false);
  const post = usePost<TransferResult & { roomId: number }>();
  const cancelPost = usePost();

  const person = p.people.find((x) => x.id === personId) ?? null;
  const room = p.rooms.find((x) => x.id === roomId) ?? null;
  const needPerson = mode !== "room";
  const needRoom = mode !== "person";
  const missing = {
    person: needPerson && !person,
    room: needRoom && !room,
    reason: !reason.trim(),
  };
  const valid = !missing.person && !missing.room && !missing.reason;
  const pname = person ? first(person.fullName) : "ผู้รับ";

  const note =
    mode === "room"
      ? "ย้ายห้องมีผลทันที ไม่ต้องรอใครกดรับ คุณยังเป็นผู้ดูแลเหมือนเดิม"
      : mode === "person"
        ? `${pname}ต้องกดรับก่อน ระหว่างรอคุณยังเป็นผู้ดูแลอยู่`
        : `${pname}ต้องกดรับก่อน ระหว่างรอคุณยังเป็นผู้ดูแล และเครื่องยังอยู่ห้อง ${p.asset.roomCode}`;

  async function submit() {
    if (mode === "room") {
      const r = await post.run(`/api/assets/${p.asset.id}/move`, {
        toRoomId: roomId,
        reason,
        idempotencyKey: key,
      });
      if (r) {
        setMoved({ from: p.asset.roomCode, to: room!.code });
        setStep("done");
        refresh();
      }
    } else {
      const r = await post.run(`/api/transfers`, {
        assetId: p.asset.id,
        toUserId: personId,
        toRoomId: mode === "both" ? roomId : null,
        reason,
        idempotencyKey: key,
      });
      if (r) {
        setSent(r);
        setStep("done");
        refresh();
      }
    }
  }

  async function cancelPending() {
    if (!p.pending) return;
    const r = await cancelPost.run(`/api/transfers/${p.pending.id}/cancel`);
    if (r) {
      setAskCancel(false);
      refresh();
    }
  }

  const assetCard = (sub?: string) => (
    <div className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <Thumb type={p.asset.type} size={56} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.35, overflowWrap: "anywhere" }}>{p.asset.name}</span>
        <span className="mono">{p.asset.code}</span>
        {sub ? <span className="meta">{sub}</span> : null}
      </div>
    </div>
  );

  /* ---------------- 10 · ผลหลังบันทึก ---------------- */
  if (step === "done") {
    const n = sent?.notification;
    const lineOk = n?.status === "sent";
    return (
      <>
        <TopBar title={mode === "room" ? "ย้ายห้อง" : "ตรวจสอบก่อนส่ง"} back={`/assets/${p.asset.id}`} />
        <div className="content narrow">
          <div className="done" role="status">
            <h2>
              <Icon name="check" size={26} stroke={2.8} color="#2F7A3A" />
              {mode === "room" ? "ย้ายห้องแล้ว" : "ส่งคำขอแล้ว"}
            </h2>
            {mode === "room" ? (
              <p>
                เปลี่ยนห้องจาก {moved?.from} เป็น {moved?.to} และบันทึกประวัติแล้ว คุณยังเป็นผู้ดูแลเหมือนเดิม
              </p>
            ) : lineOk ? (
              <p>แจ้ง{pname}ทาง LINE แล้ว เมื่อ{pname}ตอบ คุณจะได้รับแจ้งทาง LINE เช่นกัน</p>
            ) : (
              <p>ระหว่างรอ ห้องและผู้รับผิดชอบยังเป็นแบบเดิม</p>
            )}
            {mode !== "room" && !lineOk ? (
              <div className="alert warn" style={{ margin: "0 0 16px" }}>
                <Icon name="warning" size={19} color="#9A3F00" />
                <span>
                  <strong>{person && !person.hasLine ? "ผู้รับยังไม่เชื่อม LINE" : "ส่งแจ้งเตือน LINE ไม่สำเร็จ"}</strong>
                  บันทึกคำขอแล้ว ผู้รับยังเห็นคำขอในเมนูคำขอบนเว็บ
                  {n?.error ? <span className="meta" style={{ display: "block", marginTop: 2 }}>สาเหตุ: {n.error}</span> : null}
                </span>
              </div>
            ) : null}
            <div className="card">
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--line-soft)" }}>
                <Thumb type={p.asset.type} size={52} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 600, overflowWrap: "anywhere" }}>{p.asset.name}</span>
                  <span className="mono">{p.asset.code}</span>
                </div>
              </div>
              {mode === "room" ? (
                <div style={{ padding: "12px 14px", fontSize: 15, fontWeight: 600 }} className="tone-ok">
                  อยู่ห้อง {moved?.to} คุณเป็นผู้ดูแล
                </div>
              ) : (
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 }} className="tone-info">
                  <Icon name="clock" size={19} stroke={2.2} />
                  รอ{pname}กดรับ
                </div>
              )}
            </div>
            {sent ? (
              <p style={{ margin: "12px 4px 0", fontSize: 13.5 }} className="muted">
                เลขที่คำขอ <span className="mono" style={{ fontSize: 13.5 }}>{sent.request.code}</span> ส่งเมื่อ {sent.request.createdAtText}
              </p>
            ) : null}
          </div>
        </div>
        <div className="actionbar">
          {mode === "room" ? (
            <Link href={`/assets/${p.asset.id}`} className="btn secondary">ดูครุภัณฑ์</Link>
          ) : (
            <Link href="/requests?tab=out" className="btn secondary">ดูคำขอของฉัน</Link>
          )}
          <Link href="/" className="btn">กลับหน้าหลัก</Link>
        </div>
      </>
    );
  }

  /* ---------------- 10 · ตรวจสอบก่อนส่ง ---------------- */
  if (step === "review") {
    const after = mode === "room" ? "หลังย้าย" : `เมื่อ${pname}กดรับ`;
    return (
      <>
        <header className="topbar">
          <button type="button" className="icon-btn" aria-label="ย้อนกลับ" onClick={() => setStep("form")}>
            <Icon name="back" stroke={2.2} />
          </button>
          <h1>{mode === "room" ? "ตรวจสอบก่อนย้าย" : "ตรวจสอบก่อนส่ง"}</h1>
        </header>
        <div className="content narrow" style={{ padding: "12px 16px 0" }}>
          {assetCard(`อยู่ห้อง ${p.asset.roomCode} คุณเป็นผู้ดูแล`)}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="compare head"><span /><span>ตอนนี้</span><span>{after}</span></div>
            <div className="compare">
              <span>ผู้ดูแล</span>
              <span><Avatar person={p.me} size={28} />คุณ</span>
              <span style={{ fontWeight: mode === "room" ? 400 : 600 }}>
                {mode === "room" ? (
                  <><Avatar person={p.me} size={28} />คุณ (เหมือนเดิม)</>
                ) : (
                  <><Avatar person={person!} size={28} />{pname}</>
                )}
              </span>
            </div>
            <div className="compare">
              <span>ห้อง</span>
              <span>{p.asset.roomCode}</span>
              <span style={{ fontWeight: needRoom ? 600 : 400 }}>{needRoom ? room!.code : `${p.asset.roomCode} (เหมือนเดิม)`}</span>
            </div>
          </div>
          <div className="card" style={{ marginTop: 12, padding: "14px 16px" }}>
            <span style={{ fontSize: 13 }} className="muted">เหตุผล</span>
            <p style={{ marginTop: 2, fontSize: 15.5, lineHeight: 1.5, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{reason.trim()}</p>
          </div>
          <ul className="bullets">
            {mode === "room" ? (
              <>
                <li><Icon name="check" size={18} color="#55555F" />เปลี่ยนห้องจาก {p.asset.roomCode} เป็น {room!.code} และบันทึกประวัติทันที ไม่ต้องรอตอบรับ</li>
                <li><Icon name="info" size={18} color="#55555F" />คุณยังเป็นผู้ดูแลเหมือนเดิม</li>
              </>
            ) : (
              <>
                <li>
                  <Icon name="chat" size={18} color="#55555F" />
                  {person!.hasLine ? `${pname}จะได้รับแจ้งเตือนทาง LINE ทันที` : `${pname}ยังไม่เชื่อม LINE จะไม่ได้รับแจ้งเตือน แต่เปิดคำขอในเว็บได้`}
                </li>
                <li><Icon name="clock" size={18} color="#55555F" />ระหว่างรอ คุณยังเป็นผู้ดูแล และเครื่องยังอยู่ห้อง {p.asset.roomCode}</li>
                <li><Icon name="info" size={18} color="#55555F" />ถ้า{pname}ไม่รับ ทุกอย่างจะคงเดิม</li>
              </>
            )}
          </ul>
          {post.error ? (
            <div className="alert err" role="alert" style={{ margin: "16px 0 0" }}>
              <Icon name="warning" size={19} color="#C3002F" />
              <span><strong>ทำรายการไม่สำเร็จ</strong>{post.error.error}</span>
            </div>
          ) : null}
        </div>
        <div className="actionbar">
          <button type="button" className="btn" onClick={submit} disabled={post.pending} aria-busy={post.pending}>
            <Icon name="arrowRight" size={19} color="#fff" />
            {post.pending ? "กำลังบันทึก…" : mode === "room" ? "ยืนยันย้ายห้อง" : "ส่งคำขอ"}
          </button>
        </div>
      </>
    );
  }

  /* ---------------- 07 · ฟอร์มย้าย / ส่งต่อ ---------------- */
  return (
    <>
      <TopBar title="ย้าย / ส่งต่อ" back={`/assets/${p.asset.id}`} />
      <div className="content narrow" style={{ padding: "12px 16px 0" }}>
        {assetCard(`อยู่ห้อง ${p.asset.roomCode} คุณเป็นผู้ดูแล`)}

        {p.pending ? (
          <div className="alert" style={{ margin: "12px 0 0" }}>
            <Icon name="clock" size={19} color="#1F6A8A" />
            <span style={{ flex: 1 }}>
              <strong className="tone-info">รอ{first(p.pending.toName)}กดรับ</strong>
              ส่งคำขอเมื่อ {p.pending.createdAtText} ต้องยกเลิกคำขอนี้ก่อนจึงย้ายหรือส่งต่อใหม่ได้
              <span style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Link href={`/requests/${p.pending.id}`} className="btn secondary sm">ดูคำขอ</Link>
                <button type="button" className="btn secondary sm" onClick={() => setAskCancel(true)}>ยกเลิกคำขอ</button>
              </span>
            </span>
          </div>
        ) : (
          <>
            <p style={{ margin: "18px 4px 8px", fontSize: 15, fontWeight: 600 }} className="muted">ต้องการเปลี่ยนอะไร</p>
            <div role="radiogroup" aria-label="ต้องการเปลี่ยนอะไร" className="seg tall">
              {(
                [
                  ["room", "ย้ายห้อง"],
                  ["person", "ส่งต่อ"],
                  ["both", "ทั้งสองอย่าง"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              {needPerson ? (
                <button type="button" className="pick-row" onClick={() => setPicker("person")} aria-label={person ? `ส่งต่อให้ ${person.fullName} แตะเพื่อเปลี่ยน` : "เลือกผู้ดูแลคนใหม่"}>
                  {person ? <Avatar person={person} size={36} /> : <span className="room-badge" style={{ width: 36, height: 36, borderRadius: 18 }}><Icon name="user" size={18} /></span>}
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", lineHeight: 1.4, minWidth: 0 }}>
                    <span style={{ fontSize: 13 }} className="muted">ส่งต่อให้</span>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{person ? person.fullName : "เลือกผู้ดูแลคนใหม่"}</span>
                  </span>
                  <span style={{ fontSize: 14 }} className="muted">{person ? "เปลี่ยน" : "เลือก"}</span>
                  <Icon name="chevronRight" size={18} color="#55555F" />
                </button>
              ) : null}
              {needRoom ? (
                <button type="button" className="pick-row" onClick={() => setPicker("room")} aria-label={room ? `ย้ายไปห้อง ${room.code} แตะเพื่อเปลี่ยน` : "เลือกห้อง"}>
                  <span className="room-badge" style={{ width: 36, height: 36, borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>{room ? room.code : "—"}</span>
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", lineHeight: 1.4, minWidth: 0 }}>
                    <span style={{ fontSize: 13 }} className="muted">ย้ายไปห้อง</span>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{room ? `${room.code}${room.name ? ` ${room.name}` : ""}` : "เลือกห้อง"}</span>
                  </span>
                  <span style={{ fontSize: 14 }} className="muted">{room ? "เปลี่ยน" : "เลือก"}</span>
                  <Icon name="chevronRight" size={18} color="#55555F" />
                </button>
              ) : null}
            </div>
            {touched && (missing.person || missing.room) ? (
              <p className="field-error" style={{ marginTop: 8 }}>
                {missing.person ? "กรุณาเลือกผู้ดูแลคนใหม่" : "กรุณาเลือกห้องปลายทาง"}
              </p>
            ) : null}

            <label className="field" style={{ marginTop: 16, gap: 8 }}>
              <span style={{ fontSize: 15 }} className="muted">เหตุผล</span>
              <textarea
                className="textarea"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น ย้ายไปใช้ในงานบริการ ห้อง 213"
                aria-invalid={touched && missing.reason}
                aria-describedby="reason-err"
              />
              {touched && missing.reason ? (
                <span id="reason-err" className="field-error">กรุณาระบุเหตุผลก่อนดำเนินการต่อ</span>
              ) : null}
            </label>
            <p className="note" style={{ margin: "12px 4px 0" }}>
              <Icon name="info" size={18} color="#55555F" />
              <span>{note}</span>
            </p>
          </>
        )}
      </div>

      {p.pending ? null : (
        <div className="actionbar">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setTouched(true);
              if (valid) {
                post.setError(null);
                setStep("review");
              }
            }}
          >
            {mode === "room" ? "ตรวจสอบแล้วย้าย" : "ตรวจสอบก่อนส่ง"}
          </button>
        </div>
      )}

      <PickPerson
        open={picker === "person"}
        people={p.people}
        value={personId}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          setPersonId(id);
          setPicker(null);
        }}
      />
      <PickRoom
        open={picker === "room"}
        rooms={p.rooms}
        currentId={p.asset.roomId}
        value={roomId}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          setRoomId(id);
          setPicker(null);
        }}
      />
      <Sheet open={askCancel} onClose={() => setAskCancel(false)} label="ยกเลิกคำขอส่งต่อ">
        <h2>ยกเลิกคำขอส่งต่อ?</h2>
        <p className="lead">{p.pending ? `${first(p.pending.toName)}จะตอบคำขอนี้ไม่ได้อีก ครุภัณฑ์ยังอยู่กับคุณที่ห้อง ${p.asset.roomCode}` : ""}</p>
        {cancelPost.error ? <p className="field-error" role="alert">{cancelPost.error.error}</p> : null}
        <button type="button" className="btn" onClick={cancelPending} disabled={cancelPost.pending}>
          {cancelPost.pending ? "กำลังยกเลิก…" : "ยืนยัน ยกเลิกคำขอ"}
        </button>
        <button type="button" className="btn secondary" onClick={() => setAskCancel(false)}>ไม่ยกเลิก</button>
      </Sheet>
    </>
  );
}

/* ---------------- 08 · เลือกผู้ดูแลคนใหม่ ---------------- */
function PickPerson({
  open,
  people,
  value,
  onClose,
  onPick,
}: {
  open: boolean;
  people: Person[];
  value: string | null;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(value);
  const list = useMemo(
    () => people.filter((x) => !q.trim() || `${x.fullName} ${x.position}`.toLowerCase().includes(q.trim().toLowerCase())),
    [people, q],
  );
  const chosen = people.find((x) => x.id === sel);
  return (
    <Sheet open={open} onClose={onClose} label="เลือกผู้ดูแลคนใหม่" full>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
        <header className="topbar">
          <button type="button" className="icon-btn" aria-label="ปิด" onClick={onClose}><Icon name="close" stroke={2.2} /></button>
          <h1>เลือกผู้ดูแลคนใหม่</h1>
        </header>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", paddingBottom: 12 }}>
          <label className="search" style={{ margin: "12px 16px 0" }}>
            <Icon name="search" size={19} color="#17171A" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือตำแหน่ง" aria-label="ค้นหาชื่อหรือตำแหน่ง" />
          </label>
          <h2 className="section-title">บุคลากรในสาขา {people.length} คน</h2>
          <div role="radiogroup" aria-label="ผู้ดูแลคนใหม่" className="list">
            {list.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={sel === x.id} className="pick-row" onClick={() => setSel(x.id)}>
                <Avatar person={x} size={44} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1, lineHeight: 1.4 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{x.fullName}</span>
                  <span style={{ fontSize: 13.5 }} className="muted">{x.position}</span>
                  {!x.hasLine ? (
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--orange)" }}>ยังไม่เชื่อม LINE จะไม่ได้รับแจ้งเตือน</span>
                  ) : null}
                </span>
                {sel === x.id ? <Icon name="check" size={22} stroke={2.6} color="#C3002F" /> : null}
              </button>
            ))}
            {!list.length ? <p className="empty">ไม่พบ “{q}”</p> : null}
          </div>
        </div>
        <div className="actionbar" style={{ margin: 0, borderRadius: 0 }}>
          <button type="button" className="btn" disabled={!chosen} onClick={() => chosen && onPick(chosen.id)}>
            {chosen ? `เลือก${first(chosen.fullName)}` : "เลือกผู้ดูแลคนใหม่"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- 09 · เลือกห้อง ---------------- */
function PickRoom({
  open,
  rooms,
  currentId,
  value,
  onClose,
  onPick,
}: {
  open: boolean;
  rooms: RoomOpt[];
  currentId: number;
  value: number | null;
  onClose: () => void;
  onPick: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(value);
  const list = rooms.filter((r) => !q.trim() || `${r.code} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const chosen = rooms.find((r) => r.id === sel);
  return (
    <Sheet open={open} onClose={onClose} label="ย้ายไปห้องไหน" full>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
        <header className="topbar">
          <button type="button" className="icon-btn" aria-label="ปิด" onClick={onClose}><Icon name="close" stroke={2.2} /></button>
          <h1>ย้ายไปห้องไหน</h1>
        </header>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", paddingBottom: 12 }}>
          <label className="search" style={{ margin: "12px 16px 0" }}>
            <Icon name="search" size={19} color="#17171A" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขห้อง" aria-label="ค้นหาเลขห้อง" inputMode="search" />
          </label>
          <h2 className="section-title">ห้องในสาขา</h2>
          <div role="radiogroup" aria-label="ห้องปลายทาง" className="list">
            {list.map((r) => {
              const cur = r.id === currentId;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={sel === r.id}
                  aria-disabled={cur}
                  className="pick-row"
                  onClick={() => !cur && setSel(r.id)}
                >
                  <span className="room-badge" style={cur ? { background: "var(--selected)" } : undefined}>{r.code}</span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{cur ? "ห้องที่เครื่องนี้อยู่ตอนนี้" : r.name || `ห้อง ${r.code}`}</span>
                    <span style={{ fontSize: 13.5 }} className="muted">{cur ? "ห้องปัจจุบัน" : `มีครุภัณฑ์ ${r.n} รายการ`}</span>
                  </span>
                  {sel === r.id ? <Icon name="check" size={22} stroke={2.6} color="#C3002F" /> : null}
                </button>
              );
            })}
            {!list.length ? <p className="empty">ไม่พบห้อง “{q}”</p> : null}
          </div>
        </div>
        <div className="actionbar" style={{ margin: 0, borderRadius: 0 }}>
          <button type="button" className="btn" disabled={!chosen} onClick={() => chosen && onPick(chosen.id)}>
            {chosen ? `เลือกห้อง ${chosen.code}` : "เลือกห้อง"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
