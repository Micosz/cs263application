import Link from "next/link";
import { Thumb, TopBar } from "@/components/bits";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/format";
import { describeEvent } from "@/lib/history";
import { listMyHistory, MY_HISTORY_KINDS, type MyHistoryFilter } from "@/services/queries";

export const metadata = { title: "ประวัติของฉัน" };

const FILTERS: [MyHistoryFilter | "", string][] = [
  ["", "ทั้งหมด"],
  ["review", "ทบทวน"],
  ["transfer", "ส่งต่อ/รับ"],
  ["move", "ย้ายห้อง"],
];

/** ทุกรายการที่ผู้ใช้ทำเอง เรียงตามวัน ใช้เป็นหลักฐานย้อนหลังได้ */
export default async function MyHistoryPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = sp.kind && sp.kind in MY_HISTORY_KINDS ? (sp.kind as MyHistoryFilter) : undefined;
  const rows = await listMyHistory(user.id, filter);

  const days: { day: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const day = fmtDate(r.createdAt);
    if (days.at(-1)?.day !== day) days.push({ day, items: [] });
    days.at(-1)!.items.push(r);
  }

  return (
    <>
      <TopBar title="ประวัติของฉัน" back="/account" />
      <div className="content narrow">
        <div className="chips" role="group" aria-label="กรองตามประเภท">
          {FILTERS.map(([id, label]) => (
            <Link
              key={id}
              href={id ? `/account/history?kind=${id}` : "/account/history"}
              className="chip"
              aria-pressed={(filter ?? "") === id}
              replace
              scroll={false}
            >
              {label}
            </Link>
          ))}
        </div>

        {!rows.length ? (
          <p className="empty">{filter ? "ยังไม่มีรายการประเภทนี้" : "ยังไม่มีประวัติการทำรายการ"}</p>
        ) : null}

        {days.map((d) => (
          <section key={d.day}>
            <h2 className="day-head">{d.day}</h2>
            <div className="list">
              {d.items.map((e) => {
                const t = describeEvent(e, user.id);
                return (
                  <Link key={e.id} href={`/assets/${e.asset.id}`} className="item" style={{ alignItems: "flex-start", padding: "12px 14px" }}>
                    <Thumb type={e.asset.type} size={48} />
                    <span className="item-body" style={{ gap: 2 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.4, overflowWrap: "anywhere" }}>{t.text}</span>
                      <span style={{ fontSize: 14.5, overflowWrap: "anywhere" }}>{e.asset.name}</span>
                      <span className="mono">{e.asset.code}</span>
                      {t.sub ? <span className="meta" style={{ overflowWrap: "anywhere" }}>{t.sub}</span> : null}
                    </span>
                    <time dateTime={e.createdAt.toISOString()} className="meta" style={{ flexShrink: 0 }}>
                      {fmtTime(e.createdAt)}
                    </time>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {rows.length >= 200 ? <p className="empty">แสดง 200 รายการล่าสุด</p> : null}
      </div>
    </>
  );
}
