import Link from "next/link";
import { PageHead, StateCard, Thumb } from "@/components/bits";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { fmtDay, shortName } from "@/lib/format";
import { groupByRoom, listMyAssets, pendingOutgoingByAsset } from "@/services/queries";

export const metadata = { title: "ครุภัณฑ์ของฉัน" };

type Tab = "todo" | "done" | "all";

export default async function MyAssetsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const [{ rows, round }, outgoing, sp] = await Promise.all([
    listMyAssets(user),
    pendingOutgoingByAsset(user.id),
    searchParams,
  ]);
  const todoCount = rows.filter((r) => !r.reviewedAt).length;
  const doneCount = rows.length - todoCount;
  const fallback: Tab = round && todoCount > 0 ? "todo" : "all";
  const tab: Tab = round && (sp.tab === "todo" || sp.tab === "done" || sp.tab === "all") ? sp.tab : fallback;
  const picked = rows.filter((r) => (tab === "all" ? true : tab === "todo" ? !r.reviewedAt : !!r.reviewedAt));
  const groups = groupByRoom(picked);
  const roomTotal = new Set(rows.map((r) => r.roomId)).size;

  return (
    <div className="content">
      <PageHead title="ของฉัน" sub={`${rows.length} รายการ ใน ${roomTotal} ห้อง`} />
      {round ? (
        <div role="tablist" aria-label="กรอง" className="seg" style={{ margin: "2px 16px 0" }}>
          {(
            [
              ["todo", `ต้องทบทวน ${todoCount}`],
              ["done", `ทบทวนแล้ว ${doneCount}`],
              ["all", "ทั้งหมด"],
            ] as const
          ).map(([id, label]) => (
            <Link key={id} href={`/mine?tab=${id}`} role="tab" aria-selected={tab === id} replace scroll={false}>
              {label}
            </Link>
          ))}
        </div>
      ) : null}

      {!rows.length ? (
        <StateCard
          title="ไม่มีรายการในความรับผิดชอบ"
          message="ยังไม่มีครุภัณฑ์ที่คุณรับผิดชอบ หากไม่ถูกต้อง โปรดแจ้งผู้ดูแลระบบ"
        />
      ) : !picked.length ? (
        <p className="empty">{tab === "todo" ? "ทบทวนครบทุกรายการแล้ว" : "ยังไม่มีรายการที่ทบทวนแล้ว"}</p>
      ) : null}

      <div className="groups">
        {groups.map((g) => (
          <section key={g.roomId} id={`room-${g.code}`}>
            <h2 className="section-title" style={{ color: "var(--ink)", paddingTop: 18 }}>
              <span>
                ห้อง {g.code}
                {g.name ? ` ${g.name}` : ""}
              </span>
              <span className="count">{g.items.length} รายการ</span>
            </h2>
            <div className="list">
              {g.items.map((r) => (
                <div key={r.id} className="item" style={{ padding: "10px 12px 10px 14px" }}>
                  <Link
                    href={`/assets/${r.id}`}
                    style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, color: "inherit", textDecoration: "none" }}
                  >
                    <Thumb type={r.type} />
                    <span className="item-body">
                      <span className="item-title">{r.name}</span>
                      <span className="mono">{r.code}</span>
                      {outgoing.has(r.id) ? (
                        <span className="meta tone-info" style={{ fontWeight: 600 }}>
                          รอ{shortName(outgoing.get(r.id)!)}กดรับ
                        </span>
                      ) : null}
                    </span>
                  </Link>
                  {round && !r.reviewedAt ? (
                    <Link href={`/review?asset=${r.id}`} className="btn-outline-red">
                      ทบทวน
                    </Link>
                  ) : null}
                  {round && r.reviewedAt ? (
                    <span className="status tone-ok" style={{ fontSize: 13.5 }}>
                      <Icon name="check" size={16} stroke={2.6} color="#2F7A3A" />
                      {fmtDay(r.reviewedAt)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
