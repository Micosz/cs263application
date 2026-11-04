import Link from "next/link";
import { Avatar, StateCard, TopBar, typeImg } from "@/components/bits";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { fmtDate, fmtDateShort, fmtDay, roomLabel, shortName } from "@/lib/format";
import { describeEvent, REVIEW_LABEL } from "@/lib/history";
import { getAssetDetail } from "@/services/queries";

export const metadata = { title: "ครุภัณฑ์" };

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ all?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  let d: Awaited<ReturnType<typeof getAssetDetail>>;
  try {
    d = await getAssetDetail(user, id);
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    return (
      <>
        <TopBar title="ครุภัณฑ์" back="/mine" />
        <StateCard
          title={e.status === 403 ? "ไม่มีสิทธิ์เข้าถึง" : "ไม่พบรายการ"}
          message={e.message}
          action={{ href: "/mine", label: "กลับไปครุภัณฑ์ของฉัน" }}
        />
      </>
    );
  }

  const { asset, room, custodian } = d;
  const isMe = custodian.id === user.id;
  const showAll = sp.all === "1";
  const history = d.history.map((h) => ({ ...h, ...describeEvent(h, user.id) }));

  const actions = d.canManage ? (
    <>
      <Link href={`/assets/${asset.id}/manage`} className="btn secondary">
        <Icon name="swap" size={19} />
        ย้าย / ส่งต่อ
      </Link>
      {d.round ? (
        <Link href={`/review?asset=${asset.id}`} className="btn">
          ทบทวน
        </Link>
      ) : null}
    </>
  ) : null;

  const historyList = (limit?: number) => (
    <div className="list">
      {(limit ? history.slice(0, limit) : history).map((h) => (
        <div key={h.id} className="history-row">
          <time dateTime={h.createdAt.toISOString()}>{fmtDateShort(h.createdAt)}</time>
          <span style={{ minWidth: 0 }}>
            {h.text}
            {h.sub ? <span className="sub">{h.sub}</span> : null}
          </span>
        </div>
      ))}
      {!history.length ? <p className="empty">ยังไม่มีประวัติ</p> : null}
    </div>
  );

  return (
    <>
      <TopBar title="ครุภัณฑ์" back={isMe ? "/mine" : "/assets"} />
      <div className="content">
        <div className="desk-2">
          <div>
            <div style={{ background: "#fff" }} className="detail-hero">
              <div style={{ height: 168, background: "var(--thumb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={typeImg(asset.typeKey)} alt={`ภาพประกอบ${d.typeLabel}`} width={150} height={150} />
              </div>
              <div style={{ padding: "14px 20px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="mono" style={{ alignSelf: "flex-start", fontSize: 13, background: "var(--thumb)", borderRadius: 5, padding: "1px 6px" }}>
                  {asset.code}
                </span>
                <h2 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, overflowWrap: "anywhere" }}>{asset.name}</h2>
                {d.round ? (
                  d.roundReview ? (
                    <span className="tone-ok" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14.5, fontWeight: 600 }}>
                      <Icon name="check" size={18} stroke={2.4} />
                      ทบทวนแล้วในรอบนี้ {fmtDay(d.roundReview.at)} · {REVIEW_LABEL[d.roundReview.result]}
                    </span>
                  ) : (
                    <span className="tone-warn" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14.5, fontWeight: 600 }}>
                      <Icon name="clock" size={18} stroke={2.2} />
                      ยังไม่ทบทวนในรอบนี้ ปิดรอบ {fmtDay(d.round.endsAt)}
                    </span>
                  )
                ) : null}
              </div>
            </div>

            {d.pending ? (
              <Link href={`/requests/${d.pending.id}`} className="alert" style={{ textDecoration: "none", color: "inherit" }}>
                <Icon name="clock" size={19} color="#1F6A8A" />
                <span>
                  <strong className="tone-info">
                    {d.pending.toUser.id === user.id ? "มีคำขอส่งต่อถึงคุณ" : `รอ${shortName(d.pending.toUser.fullName)}กดรับ`}
                  </strong>
                  ส่งเมื่อ {fmtDay(d.pending.createdAt)}
                  {d.pending.toRoomCode ? ` · ย้ายไปห้อง ${d.pending.toRoomCode} เมื่อกดรับ` : ""}
                  {" · "}ระหว่างรอ ผู้ดูแลและห้องยังเป็นแบบเดิม
                </span>
              </Link>
            ) : null}

            <div className="card" style={{ margin: "12px 16px 0" }}>
              <div className="kv">
                <span className="k-icon"><Icon name="pin" /></span>
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
                  <span className="k">อยู่ที่</span>
                  <span className="v">ห้อง {roomLabel(room)}</span>
                </span>
              </div>
              <div className="kv">
                <Avatar person={custodian} size={36} />
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
                  <span className="k">ผู้ดูแล</span>
                  <span className="v">
                    {custodian.fullName}
                    {isMe ? " (คุณ)" : ""}
                  </span>
                </span>
              </div>
              <div className="kv">
                <span className="k-icon"><Icon name="check" /></span>
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
                  <span className="k">ทบทวนครั้งล่าสุด</span>
                  <span className="v">
                    {d.lastReview ? `${fmtDate(d.lastReview.at)} ${REVIEW_LABEL[d.lastReview.result]}` : "ยังไม่เคยทบทวน"}
                  </span>
                </span>
              </div>
            </div>
            {actions ? <div className="desk-only" style={{ margin: "16px", display: "flex", gap: 10 }}>{actions}</div> : null}
          </div>

          <section>
            <h2 className="section-title">
              ประวัติ
              {history.length > 5 && !showAll ? (
                <Link href={`/assets/${asset.id}?all=1`} className="link-btn mobile-only" scroll={false}>
                  ดูทั้งหมด {history.length}
                </Link>
              ) : (
                <span className="count">{history.length} รายการ</span>
              )}
            </h2>
            <div className="mobile-only">{historyList(showAll ? undefined : 5)}</div>
            <div className="desk-only">{historyList()}</div>
          </section>
        </div>
      </div>
      {actions ? <div className="actionbar mobile-only">{actions}</div> : <div style={{ height: 24 }} />}
    </>
  );
}
