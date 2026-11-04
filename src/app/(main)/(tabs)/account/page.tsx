import Link from "next/link";
import { Avatar, PageHead } from "@/components/bits";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { isLineLoginConfigured } from "@/lib/line/config";
import { listMyAssets } from "@/services/queries";
import { LineManage, LogoutButton, Prefs } from "./AccountClient";

export const metadata = { title: "บัญชี" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { rows } = await listMyAssets(user);

  return (
    <div className="content narrow">
      <PageHead title="บัญชี" />
      {sp.linked ? (
        <div className="alert ok" role="status" style={{ marginTop: 0, marginBottom: 12 }}>
          <Icon name="check" size={19} color="#2F7A3A" />
          <span><strong>เชื่อมบัญชีแล้ว</strong>จะเริ่มแจ้งเตือนทาง LINE ตั้งแต่ตอนนี้</span>
        </div>
      ) : null}
      {sp.error === "line_taken" ? (
        <div className="alert err" role="alert" style={{ marginTop: 0, marginBottom: 12 }}>
          <Icon name="warning" size={19} color="#C3002F" />
          <span><strong>เชื่อม LINE ไม่สำเร็จ</strong>บัญชี LINE นี้เชื่อมกับผู้ใช้อื่นอยู่แล้ว ติดต่อผู้ดูแลระบบ</span>
        </div>
      ) : null}
      <div className="pad">
        <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar person={user} size={56} />
          <div style={{ display: "flex", flexDirection: "column", gap: 1, lineHeight: 1.4, minWidth: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{user.fullName}</span>
            <span style={{ fontSize: 14 }} className="muted">{user.position}</span>
            <span className="mono" style={{ fontSize: 12.5 }}>{user.username}</span>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <Link href="/mine" className="kv" style={{ color: "inherit", textDecoration: "none", minHeight: 56 }}>
            <span className="k-icon" style={{ width: "auto" }}><Icon name="box" /></span>
            <span style={{ flex: 1, fontSize: 16 }}>ครุภัณฑ์ที่ฉันดูแล</span>
            <span style={{ fontSize: 14.5 }} className="muted">{rows.length} รายการ</span>
            <Icon name="chevronRight" size={18} color="#6B6B75" />
          </Link>
          <div className="kv" style={{ minHeight: 56 }}>
            <span className="k-icon" style={{ width: "auto" }}><Icon name="chat" /></span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
              <span style={{ fontSize: 16 }}>LINE</span>
              {user.lineUserId ? (
                <span style={{ fontSize: 13.5, fontWeight: 600 }} className="tone-ok">เชื่อมกับ {user.lineDisplayName ?? "LINE"} แล้ว</span>
              ) : (
                <span style={{ fontSize: 13.5, fontWeight: 600 }} className="tone-warn">ยังไม่เชื่อม LINE จะไม่ได้รับแจ้งเตือน</span>
              )}
            </span>
            {user.lineUserId ? (
              <LineManage lineName={user.lineDisplayName ?? "LINE"} />
            ) : isLineLoginConfigured() ? (
              <a href="/api/auth/line/login?next=%2Faccount" className="btn line sm" style={{ flex: "none" }}>เชื่อม LINE</a>
            ) : (
              <span className="meta" style={{ maxWidth: 140, textAlign: "right" }}>ยังไม่ได้ตั้งค่า LINE Login</span>
            )}
          </div>
        </div>

        <p style={{ padding: "18px 4px 8px", fontSize: 15, fontWeight: 600 }} className="muted">แจ้งเตือนทาง LINE เมื่อ</p>
        <Prefs notifyReview={user.notifyReview} notifyResult={user.notifyResult} />

        <div className="card" style={{ marginTop: 12 }}>
          <div className="kv" style={{ minHeight: 56 }}>
            <span className="k-icon" style={{ width: "auto" }}><Icon name="help" /></span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
              <span style={{ fontSize: 16 }}>ติดต่อผู้ดูแลระบบ</span>
              <span style={{ fontSize: 13.5 }} className="muted">งานไอที ห้อง 213</span>
            </span>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
