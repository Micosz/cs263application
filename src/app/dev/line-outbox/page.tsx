import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { notifications, users } from "@/db/schema";
import { isDevLoginEnabled } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "LINE outbox (dev)" };

type Flex = { altText?: string; contents?: { footer?: { contents?: { action?: { label?: string; uri?: string } }[] } } };

/** เฉพาะ development: ดูข้อความ LINE ที่ระบบพยายามส่ง และผลการส่งที่บันทึกไว้จริง */
export default async function OutboxPage() {
  if (!isDevLoginEnabled()) notFound();
  const rows = await getDb()
    .select({ n: notifications, to: users.fullName, toLine: users.lineUserId })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.recipientId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  return (
    <div className="content narrow" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>LINE outbox (เฉพาะ development)</h1>
      <p className="meta" style={{ marginTop: 4 }}>
        ข้อความที่ระบบสร้างเพื่อส่งผ่าน Messaging API พร้อมผลการส่งที่บันทึกในตาราง notifications — กดปุ่มเพื่อจำลองการกด “ดูคำขอ” ในแชท
      </p>
      <div className="stack" style={{ marginTop: 16 }}>
        {rows.map(({ n, to, toLine }) => {
          const flex = n.payload as Flex | null;
          const btn = flex?.contents?.footer?.contents?.[0]?.action;
          const local = btn?.uri?.replace(/^https:\/\/liff\.line\.me\/[^/]+/, "") ?? null;
          return (
            <div key={n.id} className="card pad16">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }} className="muted">
                <span>{n.kind} → {to}</span>
                <span>{fmtDateTime(n.createdAt)}</span>
              </div>
              <p style={{ marginTop: 6, fontWeight: 600 }}>{flex?.altText}</p>
              <p className="meta" style={{ marginTop: 4 }}>
                ผลการส่ง: <b className={n.status === "sent" ? "tone-ok" : n.status === "failed" ? "tone-err" : "tone-warn"}>{n.status}</b>
                {n.error ? ` · ${n.error}` : ""} · ครั้งที่ส่ง {n.attempts} · LINE userId {toLine ?? "-"}
              </p>
              {btn?.uri ? (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <a className="btn sm" style={{ flex: "none" }} href={local && local.startsWith("/") ? local : btn.uri}>
                    {btn.label}
                  </a>
                  <code className="mono" style={{ alignSelf: "center", overflowWrap: "anywhere" }}>{btn.uri}</code>
                </div>
              ) : null}
            </div>
          );
        })}
        {!rows.length ? <p className="empty">ยังไม่มีข้อความ</p> : null}
      </div>
    </div>
  );
}
