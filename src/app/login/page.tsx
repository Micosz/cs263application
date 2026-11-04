import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { Icon } from "@/components/Icon";
import { getCurrentUser, isDevLoginEnabled } from "@/lib/auth";
import { isLineLoginConfigured } from "@/lib/line/config";
import { safeNext } from "@/lib/safe-next";
import { DevLogin } from "./DevLogin";

export const metadata = { title: "เข้าสู่ระบบ" };

const ERRORS: Record<string, string> = {
  line_not_configured:
    "ยังไม่ได้ตั้งค่า LINE Login (LINE_LOGIN_CHANNEL_ID และ LINE_LOGIN_CHANNEL_SECRET) ดูคู่มือ docs/LINE_SETUP.md",
  cancelled: "ยกเลิกการเข้าสู่ระบบด้วย LINE แล้ว",
  state: "หมดเวลาเข้าสู่ระบบ ลองอีกครั้ง",
  line_failed: "เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้ง หรือติดต่อผู้ดูแลระบบ ห้อง 213",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);

  const dev = isDevLoginEnabled();
  const devUsers = dev
    ? await getDb()
        .select({
          username: users.username,
          fullName: users.fullName,
          position: users.position,
          avatarBg: users.avatarBg,
          avatarFg: users.avatarFg,
        })
        .from(users)
        .where(eq(users.active, true))
        .orderBy(asc(users.createdAt), asc(users.username))
    : [];
  const tagged = devUsers.map((u) => ({
    ...u,
    tag: u.username === "aree.s" ? "A" : u.username === "boonmee.k" ? "B" : undefined,
  }));
  const error = sp.error ? ERRORS[sp.error] ?? ERRORS.line_failed : null;

  return (
    <div style={{ minHeight: "100dvh", background: "#fff" }}>
      <div className="content narrow" style={{ padding: "28px 24px 24px", display: "flex", flexDirection: "column", minHeight: "100dvh", maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tu-seal.png" alt="ตรามหาวิทยาลัยธรรมศาสตร์" width={52} height={52} style={{ objectFit: "contain" }} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>มหาวิทยาลัยธรรมศาสตร์</span>
            <span style={{ fontSize: 14 }} className="muted">สาขาวิชาวิทยาการคอมพิวเตอร์</span>
          </div>
        </div>
        <h1 style={{ marginTop: 20, fontSize: 28, fontWeight: 700, lineHeight: 1.3 }}>ระบบติดตามครุภัณฑ์</h1>

        {error ? (
          <div className="alert err" role="alert" style={{ margin: "20px 0 0" }}>
            <Icon name="warning" size={19} color="#C3002F" />
            <span><strong>เข้าสู่ระบบไม่สำเร็จ</strong>{error}</span>
          </div>
        ) : null}

        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
          <a
            href={`/api/auth/line/login?next=${encodeURIComponent(next)}`}
            className="btn line block"
            style={{ height: 52 }}
            aria-disabled={!isLineLoginConfigured() || undefined}
          >
            <Icon name="chat" size={20} color="#fff" />
            เข้าสู่ระบบด้วย LINE
          </a>
          <p className="note">
            <Icon name="info" size={18} />
            <span>ใช้บัญชี LINE ที่เชื่อมกับบัญชีของคุณ ครั้งแรกระบบจะขอชื่อผู้ใช้ TU และรหัสเชื่อมบัญชีจากผู้ดูแลระบบ</span>
          </p>
        </div>

        {dev ? <DevLogin users={tagged} next={next} /> : null}

        <p style={{ margin: "auto 0 0", paddingTop: 24, fontSize: 14, lineHeight: 1.6, textAlign: "center" }} className="muted">
          เข้าไม่ได้ ติดต่อผู้ดูแลระบบ ห้อง 213
        </p>
      </div>
    </div>
  );
}
