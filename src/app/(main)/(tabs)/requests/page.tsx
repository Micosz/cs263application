import Link from "next/link";
import { Avatar, PageHead, Thumb } from "@/components/bits";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { fmtDateTime, fmtDay, shortName } from "@/lib/format";
import { getRequestDetail, listRequests } from "@/services/queries";
import { IncomingCard } from "./IncomingCard";

export const metadata = { title: "คำขอ" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; accepted?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "out" ? "out" : "in";
  const data = await listRequests(user);
  const justAccepted = sp.accepted
    ? await getRequestDetail(user, sp.accepted).catch(() => null)
    : null;

  const incoming = (
    <section>
      {data.incomingPending.length ? (
        <>
          <h2 className="section-title">รอคุณตอบ</h2>
          <div className="stack" style={{ margin: "0 16px" }}>
            {data.incomingPending.map((r) => (
              <IncomingCard
                key={r.id}
                id={r.id}
                from={r.from}
                createdAtText={fmtDateTime(r.createdAt)}
                reason={r.reason}
                asset={r.asset}
                fromRoomCode={r.fromRoomCode}
                toRoomCode={r.toRoomCode}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="empty">ไม่มีคำขอค้าง</p>
      )}

      {justAccepted && justAccepted.status === "accepted" && justAccepted.toUserId === user.id ? (
        <>
          <h2 className="section-title">เพิ่งตอบ</h2>
          <div role="status" className="card" style={{ margin: "0 16px", padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <Thumb type={justAccepted.asset.type} size={52} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="tone-ok" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15.5, fontWeight: 600 }}>
                <Icon name="check" size={17} stroke={2.6} />
                คุณรับแล้ว
              </span>
              <span style={{ fontSize: 14.5 }}>
                {justAccepted.asset.name} อยู่ในของคุณ ห้อง {justAccepted.currentRoomCode}
              </span>
            </div>
          </div>
        </>
      ) : null}

      {data.incomingDone.length ? (
        <>
          <h2 className="section-title">ตอบแล้ว</h2>
          <div className="list">
            {data.incomingDone.map((r) => (
              <Link key={r.id} href={`/requests/${r.id}`} className="item">
                <Thumb type={r.asset.type} size={48} />
                <span className="item-body">
                  <span className="item-title" style={{ fontSize: 15 }}>{r.asset.name}</span>
                  <span className="meta">
                    จาก{shortName(r.from.fullName)}{" "}
                    {r.status === "accepted"
                      ? `คุณรับเมื่อ ${fmtDay(r.respondedAt!)}`
                      : r.status === "rejected"
                        ? `คุณไม่รับเมื่อ ${fmtDay(r.respondedAt!)}`
                        : `ยกเลิกเมื่อ ${fmtDay(r.respondedAt!)}`}
                  </span>
                </span>
                <Icon name="chevronRight" size={18} color="#6B6B75" />
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );

  const outgoing = (
    <section>
      <h2 className="section-title">รอผู้รับตอบ</h2>
      {data.outgoingPending.length ? (
        <div className="list">
          {data.outgoingPending.map((r) => (
            <Link key={r.id} href={`/requests/${r.id}`} className="item" style={{ alignItems: "flex-start", padding: "12px 14px" }}>
              <Thumb type={r.asset.type} size={56} />
              <span className="item-body" style={{ gap: 2 }}>
                <span className="item-title" style={{ fontSize: 16 }}>{r.asset.name}</span>
                <span style={{ fontSize: 14 }} className="muted">
                  ส่งให้{shortName(r.to.fullName)}
                  {r.toRoomCode ? ` และย้ายไปห้อง ${r.toRoomCode}` : ""}
                </span>
                <span className="tone-info" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 14, fontWeight: 600 }}>
                  <Icon name="clock" size={16} stroke={2.2} />
                  รอกดรับ ส่งเมื่อ {fmtDay(r.createdAt)}
                </span>
                {r.notification && r.notification.status !== "sent" ? (
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "#9A3F00" }}>
                    {r.to.hasLine ? "ส่งแจ้งเตือน LINE ไม่สำเร็จ" : "ผู้รับยังไม่เชื่อม LINE"} · ผู้รับยังเห็นคำขอบนเว็บ
                  </span>
                ) : null}
              </span>
              <Avatar person={r.to} size={32} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="empty">ไม่มีคำขอที่รอผู้รับตอบ</p>
      )}

      {data.outgoingDone.length ? (
        <>
          <h2 className="section-title">ปิดแล้ว</h2>
          <div className="list">
            {data.outgoingDone.map((r) => (
              <Link key={r.id} href={`/requests/${r.id}`} className="item" style={{ alignItems: "flex-start", padding: "12px 14px" }}>
                <Thumb type={r.asset.type} size={56} />
                <span className="item-body" style={{ gap: 2 }}>
                  <span className="item-title" style={{ fontSize: 16 }}>{r.asset.name}</span>
                  <span style={{ fontSize: 14 }} className="muted">
                    ส่งให้{shortName(r.to.fullName)} {fmtDay(r.createdAt)}
                  </span>
                  {r.status === "rejected" ? (
                    <>
                      <span className="tone-err" style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>ไม่รับ เพราะ{r.responseReason}</span>
                      <span className="meta">
                        {r.asset.custodianId === user.id ? `เครื่องยังอยู่กับคุณที่ห้อง ${r.currentRoomCode}` : `ปัจจุบันอยู่ห้อง ${r.currentRoomCode}`}
                      </span>
                    </>
                  ) : r.status === "accepted" ? (
                    <span className="tone-ok" style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>
                      {shortName(r.to.fullName)}รับแล้ว {fmtDay(r.respondedAt!)}
                    </span>
                  ) : (
                    <span className="muted" style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>ยกเลิกแล้ว</span>
                  )}
                </span>
                <Avatar person={r.to} size={32} />
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );

  return (
    <div className="content">
      <PageHead title="คำขอ" />
      <div role="tablist" aria-label="ประเภทคำขอ" className="seg mobile-only" style={{ margin: "2px 16px 0" }}>
        <Link href="/requests" role="tab" aria-selected={tab === "in"} replace scroll={false}>
          ถึงฉัน{data.incomingPending.length ? ` ${data.incomingPending.length}` : ""}
        </Link>
        <Link href="/requests?tab=out" role="tab" aria-selected={tab === "out"} replace scroll={false}>
          ที่ฉันส่ง
        </Link>
      </div>
      <div className="mobile-only">{tab === "in" ? incoming : outgoing}</div>
      <div className="desk-only">
        <div className="desk-2">
          <div>
            <h2 className="section-title strong" style={{ paddingTop: 8 }}>ถึงฉัน</h2>
            {incoming}
          </div>
          <div>
            <h2 className="section-title strong" style={{ paddingTop: 8 }}>ที่ฉันส่ง</h2>
            {outgoing}
          </div>
        </div>
      </div>
    </div>
  );
}
