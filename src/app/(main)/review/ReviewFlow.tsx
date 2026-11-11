"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Thumb, typeImg } from "@/components/bits";
import { usePost, useRefresh } from "@/components/client";
import { Icon, type IconName } from "@/components/Icon";

type Result = "ok" | "broken" | "missing";
export type ReviewItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  roomCode: string;
  result: Result | null;
  note: string | null;
};

const OPTS: { id: Result; label: string; icon: IconName; color: string }[] = [
  { id: "ok", label: "เจอ ใช้งานได้", icon: "check", color: "#2F7A3A" },
  { id: "broken", label: "เจอ แต่ชำรุด", icon: "wrench", color: "#A14A00" },
  { id: "missing", label: "ไม่เจอ", icon: "help", color: "#C3002F" },
];
const RES = { ok: ["เจอ ใช้งานได้", "tone-ok"], broken: ["ชำรุด", "tone-warn"], missing: ["ไม่เจอ", "tone-err"] } as const;
const MARK = { ok: "#2F7A3A", broken: "#A14A00", missing: "#C3002F" } as const;
const SWIPE = 90;

/**
 * ทบทวนทีละชิ้นแบบไม่บังคับลำดับ: กรองตามห้อง ปัดขวาเพื่อข้ามไปก่อน
 * และกดชิ้นอื่นจากแถบด้านล่างได้ (ชิ้นที่ทบทวนแล้วกดกลับมาแก้ผลได้)
 */
export function ReviewFlow({ items, startId, startRoom }: { items: ReviewItem[]; startId: string; startRoom: string | null }) {
  const refresh = useRefresh();
  const post = usePost();
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(items.filter((it) => it.result).map((it) => [it.id, it.result!])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.filter((it) => it.note).map((it) => [it.id, it.note!])),
  );
  const [room, setRoom] = useState<string | null>(startRoom);
  const [curId, setCurId] = useState(startId);
  const [pick, setPick] = useState<Result | null>(() => items.find((it) => it.id === startId)?.result ?? null);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [dx, setDx] = useState(0);
  const drag = useRef<number | null>(null);
  const curBtn = useRef<HTMLButtonElement>(null);

  const rooms = [...new Set(items.map((it) => it.roomCode))];
  const visible = room ? items.filter((it) => it.roomCode === room) : items;
  const cur = items.find((it) => it.id === curId) ?? items[0];
  const doneCount = Object.keys(results).length;
  const leftIn = (code: string | null, res = results) =>
    items.filter((it) => (code ? it.roomCode === code : true) && !res[it.id]).length;

  useEffect(() => {
    curBtn.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [curId, room]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function go(id: string, res = results) {
    setCurId(id);
    setPick(res[id] ?? null);
    setDx(0);
    post.setError(null);
  }

  /** ชิ้นถัดไปที่ยังไม่ทบทวนในรายการที่กรองอยู่ (วนกลับต้นรายการ; ชิ้นที่ข้ามไว้มาทีหลัง) */
  function nextTodo(list: ReviewItem[], res: Record<string, Result>, skip: Set<string>) {
    const at = list.findIndex((it) => it.id === cur.id);
    const order = [...list.slice(at + 1), ...list.slice(0, Math.max(at, 0))].filter((it) => !res[it.id]);
    return order.find((it) => !skip.has(it.id)) ?? order[0] ?? null;
  }

  function pickRoom(code: string | null) {
    setRoom(code);
    setToast(null);
    const list = code ? items.filter((it) => it.roomCode === code) : items;
    if (!list.some((it) => it.id === cur.id)) go((list.find((it) => !results[it.id]) ?? list[0]).id);
  }

  function skip() {
    const skip2 = new Set(skipped).add(cur.id);
    const next = nextTodo(visible, results, skip2);
    setDx(0);
    if (!next) {
      setToast(room ? `ห้อง ${room} ไม่มีชิ้นอื่นที่ยังไม่ทบทวน` : "ไม่มีชิ้นอื่นที่ยังไม่ทบทวน");
      return;
    }
    setSkipped(skip2);
    setToast(null);
    go(next.id);
  }

  async function save() {
    if (!pick) return;
    const r = await post.run("/api/reviews", { assetId: cur.id, result: pick, note: notes[cur.id] ?? null });
    if (!r) return;
    const res = { ...results, [cur.id]: pick };
    setResults(res);
    setSaved((s) => (s.includes(cur.id) ? s : [...s, cur.id]));
    if (skipped.has(cur.id)) {
      const s2 = new Set(skipped);
      s2.delete(cur.id);
      setSkipped(s2);
    }
    refresh();
    if (leftIn(null, res) === 0) {
      setFinished(true);
      return;
    }
    const next = nextTodo(visible, res, skipped);
    if (next) {
      setToast(`บันทึก ${cur.name} แล้ว`);
      go(next.id, res);
    } else {
      setToast(`ทบทวนห้อง ${room ?? cur.roomCode} ครบแล้ว เลือกห้องถัดไปจากด้านบน`);
    }
  }

  if (finished) {
    const anyMissing = saved.some((id) => results[id] === "missing");
    return (
      <>
        <header className="topbar">
          <Link href="/mine" className="icon-btn" aria-label="ย้อนกลับ"><Icon name="back" stroke={2.2} /></Link>
          <h1>ทบทวนรอบนี้</h1>
        </header>
        <div className="content narrow">
          <div className="done" role="status">
            <h2><Icon name="check" size={26} stroke={2.8} color="#2F7A3A" />ทบทวนครบแล้ว</h2>
            <p>รอบนี้คุณทบทวนครบ {items.length} จาก {items.length} รายการ ผู้ดูแลระบบเห็นผลแล้ว</p>
            <div className="card">
              {items.filter((it) => saved.includes(it.id)).map((it) => (
                <div key={it.id} className="item" style={{ minHeight: 56 }}>
                  <Thumb type={it.type} size={48} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, overflowWrap: "anywhere" }}>{it.name}</span>
                  <span className={`status ${RES[results[it.id]][1]}`} style={{ fontSize: 14 }}>{RES[results[it.id]][0]}</span>
                </div>
              ))}
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

  const was = results[cur.id];
  const dirty = pick !== (was ?? null) || (pick === "broken" && (notes[cur.id] ?? "") !== (cur.note ?? ""));

  return (
    <>
      <header className="topbar">
        <Link href="/mine" className="icon-btn" aria-label="ย้อนกลับ"><Icon name="back" stroke={2.2} /></Link>
        <h1>ทบทวนรอบนี้</h1>
        <span style={{ fontSize: 14.5, fontWeight: 600 }} className="muted" aria-label={`ทบทวนแล้ว ${doneCount} จาก ${items.length}`}>
          แล้ว {doneCount}/{items.length}
        </span>
      </header>
      <div className="content narrow">
        {rooms.length > 1 ? (
          <div className="chips" role="group" aria-label="กรองตามห้อง">
            <button type="button" className="chip" aria-pressed={room === null} onClick={() => pickRoom(null)}>
              ทุกห้อง
            </button>
            {rooms.map((code) => {
              const left = leftIn(code);
              return (
                <button key={code} type="button" className="chip" aria-pressed={room === code} onClick={() => pickRoom(code)}>
                  ห้อง {code}
                  {left ? (
                    <span style={{ opacity: 0.7 }}>เหลือ {left}</span>
                  ) : (
                    <Icon name="check" size={16} stroke={2.6} label="ครบแล้ว" />
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
        <div style={{ padding: "12px 16px 0", overflowX: "clip" }}>
          <div
            className={`card review-card${dx === 0 ? " snap" : ""}`}
            style={{ transform: `translateX(${dx}px) rotate(${dx / 40}deg)`, opacity: 1 - Math.min(dx / 260, 0.6) }}
            onPointerDown={(e) => { drag.current = e.clientX; }}
            onPointerMove={(e) => { if (drag.current !== null) setDx(Math.max(0, e.clientX - drag.current)); }}
            onPointerUp={() => { drag.current = null; if (dx > SWIPE) skip(); else setDx(0); }}
            onPointerCancel={() => { drag.current = null; setDx(0); }}
            onPointerLeave={() => { if (drag.current !== null) { drag.current = null; setDx(0); } }}
          >
            <div style={{ height: 150, background: "var(--thumb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={typeImg(cur.type)} alt="" width={132} height={132} draggable={false} />
            </div>
            <div style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35, overflowWrap: "anywhere" }}>{cur.name}</span>
              <span className="mono" style={{ fontSize: 12.5 }}>{cur.code}</span>
              <span style={{ fontSize: 14 }} className="muted">ในทะเบียนอยู่ห้อง {cur.roomCode}</span>
            </div>
          </div>
          <div style={{ margin: "14px 4px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontSize: 16.5, fontWeight: 600 }}>เจอเครื่องนี้ที่ห้อง {cur.roomCode} ไหม</p>
            {!was ? (
              <button type="button" className="link-btn" style={{ color: "var(--muted)", flexShrink: 0 }} onClick={skip}>
                ข้ามไปก่อน <Icon name="arrowRight" size={17} />
              </button>
            ) : (
              <span className={`status ${RES[was][1]}`}><Icon name="check" size={16} stroke={2.6} />บันทึกแล้ว</span>
            )}
          </div>
          <div role="radiogroup" aria-label="ผลการทบทวน" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {OPTS.map((o) => {
              const on = pick === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => { setPick(o.id); setToast(null); }}
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
          {pick === "broken" ? (
            <label className="field" style={{ marginTop: 10 }}>
              <span className="sr-only">อาการเสีย</span>
              <textarea
                className="textarea"
                placeholder="อาการเสีย เช่น จอไม่ติด (ไม่บังคับ)"
                value={notes[cur.id] ?? ""}
                maxLength={500}
                onChange={(e) => setNotes({ ...notes, [cur.id]: e.target.value })}
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
      {toast && !dirty ? (
        <div role="status" className="toast" style={{ bottom: "calc(176px + var(--safe-b) + var(--kb-inset))" }}>
          <span style={{ flex: 1 }}>{toast}</span>
          <button type="button" onClick={() => setToast(null)}>ปิด</button>
        </div>
      ) : null}
      <div className="actionbar review-dock">
        <div className="review-strip" role="group" aria-label={room ? `ชิ้นอื่นในห้อง ${room}` : "ชิ้นอื่นทั้งหมด"}>
          {visible.map((it) => {
            const res = results[it.id];
            const state = res ? RES[res][0] : skipped.has(it.id) ? "ข้ามไว้" : "ยังไม่ทบทวน";
            return (
              <button
                key={it.id}
                ref={it.id === cur.id ? curBtn : undefined}
                type="button"
                aria-current={it.id === cur.id ? "true" : undefined}
                aria-label={`${it.name} ${it.code} ห้อง ${it.roomCode} ${state}`}
                onClick={() => { setToast(null); go(it.id); }}
              >
                <Thumb type={it.type} size={48} />
                <span className="mono">{it.code.split("/")[0].slice(-4)}</span>
                {res ? (
                  <span className="mark" style={{ background: MARK[res] }}>
                    <Icon name={res === "ok" ? "check" : res === "broken" ? "wrench" : "help"} size={11} stroke={3} color="#fff" />
                  </span>
                ) : skipped.has(it.id) ? (
                  <span className="mark skip" />
                ) : null}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn" onClick={save} disabled={!pick || post.pending} aria-disabled={!pick}>
          {post.pending ? "กำลังบันทึก…" : !pick ? "เลือกผลก่อนบันทึก" : was && !dirty ? "บันทึกซ้ำ" : was ? "บันทึกผลใหม่" : "บันทึก"}
        </button>
      </div>
    </>
  );
}
