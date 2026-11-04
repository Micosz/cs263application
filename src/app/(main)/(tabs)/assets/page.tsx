import Link from "next/link";
import { Suspense } from "react";
import { PageHead, Thumb, typeImg } from "@/components/bits";
import { Icon } from "@/components/Icon";
import { RoomFilter } from "@/components/RoomFilter";
import { requireUser } from "@/lib/auth";
import { fmtDay, fmtNumber, shortName } from "@/lib/format";
import { listAssetTypes, listRoomsForUser, listVisibleAssets } from "@/services/queries";

export const metadata = { title: "ค้นหาครุภัณฑ์" };

type SP = { q?: string; type?: string; room?: string; todo?: string; limit?: string };

export default async function AllAssetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    q: sp.q?.slice(0, 100),
    type: sp.type || undefined,
    roomId: sp.room ? Number(sp.room) || undefined : undefined,
    todoOnly: sp.todo === "1",
    limit: Number(sp.limit) || 60,
  };
  const [data, types, rooms] = await Promise.all([
    listVisibleAssets(user, filters),
    listAssetTypes(),
    listRoomsForUser(user),
  ]);

  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, limit: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `/assets?${s}` : "/assets";
  };

  return (
    <div className="content">
      <PageHead
        title="ค้นหาครุภัณฑ์"
        sub={`${fmtNumber(data.total)} รายการ ใน ${fmtNumber(data.roomCount)} ห้อง`}
      />
      <form action="/assets" role="search" className="search" style={{ margin: "0 16px" }}>
        <Icon name="search" size={19} color="#17171A" />
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="เลขครุภัณฑ์ ชื่อ หรือเลขห้อง"
          aria-label="ค้นหาด้วยเลขครุภัณฑ์ ชื่อ หรือเลขห้อง"
          enterKeyHint="search"
        />
        {sp.type ? <input type="hidden" name="type" value={sp.type} /> : null}
        {sp.room ? <input type="hidden" name="room" value={sp.room} /> : null}
        {sp.todo ? <input type="hidden" name="todo" value={sp.todo} /> : null}
      </form>

      <div role="radiogroup" aria-label="ประเภท" className="chips">
        <Link href={href({ type: undefined })} role="radio" aria-checked={!sp.type} className="chip">
          ทั้งหมด
        </Link>
        {types.map((t) => (
          <Link
            key={t.key}
            href={href({ type: t.key })}
            role="radio"
            aria-checked={sp.type === t.key}
            className="chip has-img"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={typeImg(t.key)} alt="" width={28} height={28} />
            {t.label}
          </Link>
        ))}
      </div>

      <div style={{ padding: "10px 16px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Suspense>
          <RoomFilter rooms={rooms} />
        </Suspense>
        {data.round ? (
          <Link href={href({ todo: sp.todo === "1" ? undefined : "1" })} className="pill" aria-pressed={sp.todo === "1"}>
            ยังไม่ทบทวนรอบนี้
          </Link>
        ) : null}
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        <div className="table-head" aria-hidden="true">
          <span />
          <span>ครุภัณฑ์</span>
          <span>ห้อง</span>
          <span>ผู้ดูแล</span>
          <span style={{ textAlign: "right" }}>{data.round ? "ทบทวนรอบนี้" : ""}</span>
        </div>
        {data.rows.map((r) => (
          <Link key={r.id} href={`/assets/${r.id}`} className="item asset-row" title={r.name}>
            <Thumb type={r.type} />
            <span className="item-body asset-main">
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span className="item-title">{r.name}</span>
                <span className="mono">{r.code}</span>
              </span>
              <span className="meta asset-meta">
                <span className="cell-room">ห้อง {r.roomCode}</span>
                <span className="cell-who">
                  ดูแลโดย{r.custodian.id === user.id ? "คุณ" : shortName(r.custodian.fullName)}
                </span>
              </span>
            </span>
            {data.round ? (
              <span className={`status ${r.reviewedAt ? "tone-ok" : "tone-warn"}`}>
                {r.reviewedAt ? fmtDay(r.reviewedAt) : "ยังไม่ทบทวน"}
              </span>
            ) : (
              <span />
            )}
          </Link>
        ))}
        {!data.rows.length ? (
          <div className="empty" role="status">
            {sp.q ? (
              <>
                <p>ไม่พบ “{sp.q}” ลองค้นด้วยเลขครุภัณฑ์ ชื่อ หรือเลขห้อง</p>
                <Link href={href({ q: undefined })} className="link-btn">
                  ล้างคำค้นหา
                </Link>
              </>
            ) : (
              <p>ไม่พบรายการในประเภทนี้</p>
            )}
          </div>
        ) : null}
      </div>
      {data.hasMore ? (
        <div style={{ padding: "12px 16px" }}>
          <Link href={href({ limit: String(filters.limit + 60) })} className="btn secondary sm block" scroll={false}>
            แสดงเพิ่ม
          </Link>
        </div>
      ) : null}
    </div>
  );
}
