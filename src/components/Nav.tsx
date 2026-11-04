"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./bits";
import { Icon, type IconName } from "./Icon";

const TABS: { id: string; label: string; href: string; icon: IconName; side: string }[] = [
  { id: "home", label: "หน้าหลัก", href: "/", icon: "home", side: "หน้าหลัก" },
  { id: "all", label: "ค้นหา", href: "/assets", icon: "search", side: "ครุภัณฑ์ทั้งหมด" },
  { id: "mine", label: "ของฉัน", href: "/mine", icon: "box", side: "ครุภัณฑ์ของฉัน" },
  { id: "requests", label: "คำขอ", href: "/requests", icon: "swap", side: "คำขอ" },
  { id: "account", label: "บัญชี", href: "/account", icon: "user", side: "บัญชี" },
];

function activeTab(path: string) {
  if (path === "/") return "home";
  if (path.startsWith("/mine") || path.startsWith("/review")) return "mine";
  if (path.startsWith("/assets")) return "all";
  if (path.startsWith("/requests")) return "requests";
  if (path.startsWith("/account")) return "account";
  return "";
}

/** เมนูล่างบนมือถือ (ดีไซน์ "Bottom nav") */
export function BottomNav({ badge }: { badge: number }) {
  const active = activeTab(usePathname());
  return (
    <nav className="bottom-nav" aria-label="เมนูหลัก">
      {TABS.map((t) => (
        <Link key={t.id} href={t.href} aria-current={t.id === active ? "page" : undefined}>
          <span className="nav-icon">
            <Icon name={t.icon} size={24} stroke={1.9} />
            {t.id === "requests" && badge > 0 ? (
              <span className="badge" aria-label={`รอคุณตอบ ${badge} รายการ`}>
                {badge}
              </span>
            ) : null}
          </span>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** เมนูด้านข้างบนคอม: รายการเดียวกับเมนูล่าง */
export function SideNav({
  badge,
  user,
}: {
  badge: number;
  user: { fullName: string; position: string; avatarBg: string; avatarFg: string };
}) {
  const active = activeTab(usePathname());
  return (
    <aside className="side-nav">
      <div className="side-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tu-seal.png" alt="ตรามหาวิทยาลัยธรรมศาสตร์" width={40} height={40} />
        <div>
          <b>ระบบติดตามครุภัณฑ์</b>
          <span>สาขาวิชาวิทยาการคอมพิวเตอร์</span>
        </div>
      </div>
      <nav aria-label="เมนูหลัก">
        {TABS.map((t) => (
          <Link key={t.id} href={t.href} aria-current={t.id === active ? "page" : undefined}>
            <Icon name={t.icon} size={22} stroke={1.9} />
            {t.side}
            {t.id === "requests" && badge > 0 ? (
              <span className="side-badge" aria-label={`รอคุณตอบ ${badge} รายการ`}>
                {badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      <div className="side-user">
        <Avatar person={user} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{user.fullName}</div>
          <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{user.position}</div>
        </div>
      </div>
    </aside>
  );
}
