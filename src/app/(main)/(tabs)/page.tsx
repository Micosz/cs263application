import Link from "next/link";
import { Avatar, Thumb } from "@/components/bits";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { fmtDay, greeting, shortName } from "@/lib/format";
import { getHomeSummary, getNextRound, listAssetTypes } from "@/services/queries";

export const metadata = { title: "หน้าหลัก" };

export default async function HomePage() {
  const user = await requireUser();
  const [s, types, next] = await Promise.all([getHomeSummary(user), listAssetTypes(), getNextRound()]);
  const label = new Map(types.map((t) => [t.key, t.label]));
  const left = s.total - s.reviewed;
  // กองคำขอตามผู้ส่ง (คงลำดับ: ผู้ส่งที่มีคำขอใหม่สุดก่อน)
  const bySender = new Map<string, { from: (typeof s.requests)[number]["from"]; items: typeof s.requests }>();
  for (const r of s.requests) {
    const g = bySender.get(r.from.id) ?? { from: r.from, items: [] };
    g.items.push(r);
    bySender.set(r.from.id, g);
  }
  const senders = [...bySender.values()];
  const roomText = (r: (typeof s.requests)[number]) =>
    r.toRoomCode ? `ย้ายจากห้อง ${r.fromRoomCode} มาห้อง ${r.toRoomCode}` : `อยู่ห้อง ${r.fromRoomCode}`;

  return (
    <div className="content">
      <div style={{ padding: "16px 12px 12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href="/account"
          aria-label={`บัญชีของ${shortName(user.fullName)}`}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, color: "inherit", textDecoration: "none" }}
        >
          <Avatar person={user} size={44} />
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>{greeting()}</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{shortName(user.fullName)}</span>
          </span>
        </Link>
        <Link
          href="/requests"
          aria-label={s.requests.length ? `การแจ้งเตือน มี ${s.requests.length} เรื่องใหม่` : "คำขอ"}
          className="icon-btn"
          style={{ background: "#fff", position: "relative" }}
        >
          <Icon name="bell" size={21} />
          {s.requests.length ? (
            <span style={{ position: "absolute", top: 10, right: 11, width: 9, height: 9, borderRadius: 5, background: "var(--red)", border: "2px solid #fff" }} />
          ) : null}
        </Link>
      </div>

      <form action="/assets" role="search" className="search" style={{ margin: "0 16px" }}>
        <Icon name="search" size={19} color="#17171A" />
        <input name="q" placeholder="ค้นหาเลขครุภัณฑ์ ชื่อ หรือห้อง" aria-label="ค้นหาเลขครุภัณฑ์ ชื่อ หรือห้อง" enterKeyHint="search" />
      </form>

      <div className="desk-2">
        <section>
          <h2 className="section-title strong">ต้องทำ</h2>
          <div className="stack" style={{ margin: "0 16px" }}>
            {senders.map((g) => {
              const first = g.items[0];
              const head = (line: string, peek?: string) => (
                <>
                  <Avatar person={g.from} size={44} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 16.5, fontWeight: 700 }}>{shortName(g.from.fullName)}</span>
                      <span style={{ fontSize: 13.5, color: "var(--muted-2)", flexShrink: 0 }}>{fmtDay(first.createdAt)}</span>
                    </span>
                    <span style={{ fontSize: 15, lineHeight: 1.4 }}>{line}</span>
                    {peek ? <span className="req-stack-peek">{peek}</span> : null}
                  </span>
                </>
              );
              if (g.items.length === 1) {
                return (
                  <div key={g.from.id} className="card pad16">
                    <div style={{ display: "flex", gap: 12 }}>
                      {head(`ส่งต่อ${label.get(first.asset.type) ?? "ครุภัณฑ์"}ให้คุณ`)}
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center" }}>
                      <Thumb type={first.asset.type} size={48} />
                      <span className="item-body">
                        <span className="item-title" style={{ fontSize: 15 }}>{first.asset.name}</span>
                        <span className="meta">{roomText(first)}</span>
                      </span>
                    </div>
                    <Link href={`/requests/${first.id}`} className="btn sm block" style={{ marginTop: 12 }}>
                      ดูและตอบ
                    </Link>
                  </div>
                );
              }
              return (
                <details key={g.from.id} className="card req-stack">
                  <summary>
                    {head(
                      `ส่งต่อให้คุณ ${g.items.length} รายการ`,
                      g.items.slice(0, 2).map((r) => r.asset.name).join(", ") +
                        (g.items.length > 2 ? ` และอีก ${g.items.length - 2}` : ""),
                    )}
                    <span className="req-stack-chev">
                      <Icon name="chevronDown" size={20} color="#6B6B75" />
                    </span>
                  </summary>
                  {g.items.map((r) => (
                    <Link key={r.id} href={`/requests/${r.id}`} className="item">
                      <Thumb type={r.asset.type} size={48} />
                      <span className="item-body">
                        <span className="item-title" style={{ fontSize: 15 }}>{r.asset.name}</span>
                        <span className="meta">{roomText(r)}</span>
                      </span>
                      <Icon name="chevronRight" size={18} color="#6B6B75" />
                    </Link>
                  ))}
                </details>
              );
            })}

            {s.round && s.total > 0 ? (
              <div className="card pad16">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>
                    {left > 0 ? `ทบทวนอีก ${left} รายการ` : "ทบทวนครบแล้ว"}
                  </span>
                  <span style={{ fontSize: 13.5, color: "var(--muted-2)" }}>ปิดรอบ {fmtDay(s.round.endsAt)}</span>
                </div>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label={`ทบทวนแล้ว ${s.reviewed} จาก ${s.total}`}
                  aria-valuenow={s.reviewed}
                  aria-valuemin={0}
                  aria-valuemax={s.total}
                >
                  <div style={{ width: `${Math.round((s.reviewed / s.total) * 100)}%` }} />
                </div>
                {left > 0 ? (
                  <>
                    <div aria-hidden="true" style={{ marginTop: 12, display: "flex", gap: 8, overflow: "hidden" }}>
                      {s.todo.slice(0, 5).map((a) => (
                        <Thumb key={a.id} type={a.type} size={48} />
                      ))}
                    </div>
                    <Link href="/review" className="btn secondary sm block" style={{ marginTop: 12 }}>
                      เริ่มทบทวน
                    </Link>
                  </>
                ) : null}
              </div>
            ) : !s.round ? (
              <div className="card pad16">
                <span style={{ fontSize: 16, fontWeight: 600 }}>ไม่อยู่ในรอบทบทวน</span>
                {next ? (
                  <p className="meta" style={{ marginTop: 4 }}>
                    รอบถัดไปเปิด {fmtDay(next.startsAt)} ระบบจะแจ้งในแชทเมื่อเปิดรอบ
                  </p>
                ) : null}
              </div>
            ) : null}

            {!s.requests.length && s.round && left === 0 ? (
              <p className="empty" style={{ padding: "4px 4px 0", textAlign: "left" }}>ไม่มีงานค้าง</p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="section-title strong">ห้องที่คุณดูแล</h2>
          {s.rooms.length ? (
            <div className="room-grid">
              {s.rooms.map((r) => (
                <Link key={r.roomId} href={`/mine#room-${r.code}`} className="room-tile">
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>ห้อง</span>
                  <span className="no">{r.code}</span>
                  <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{r.n} รายการ</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty">ยังไม่มีครุภัณฑ์ที่คุณรับผิดชอบ</p>
          )}
        </section>
      </div>
    </div>
  );
}
