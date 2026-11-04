import Link from "next/link";
import type { ReactNode } from "react";
import { initialOf } from "@/lib/format";
import { Icon } from "./Icon";

export function Avatar({
  person,
  size = 44,
}: {
  person: { fullName: string; avatarBg: string; avatarFg: string };
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="avatar"
      style={{
        width: size,
        height: size,
        background: person.avatarBg,
        color: person.avatarFg,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initialOf(person.fullName)}
    </span>
  );
}

const TYPES = new Set(["laptop", "monitor", "chair", "desktop", "projector", "printer", "ups"]);
export const typeImg = (type: string) => `/types/${TYPES.has(type) ? type : "desktop"}.svg`;

export function Thumb({
  type,
  size = 52,
  alt = "",
}: {
  type: string;
  size?: 48 | 52 | 56 | 60;
  alt?: string;
}) {
  return (
    <span className={`thumb s${size}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ไอคอน SVG ขนาดเล็กจากดีไซน์ */}
      <img src={typeImg(type)} alt={alt} width={size * 0.8} height={size * 0.8} />
    </span>
  );
}

/** หัวหน้าที่มีปุ่มย้อนกลับ/ปิด ตามดีไซน์ (52px) */
export function TopBar({
  title,
  back,
  close,
  right,
}: {
  title: string;
  back?: string;
  close?: string;
  right?: ReactNode;
}) {
  const href = back ?? close;
  return (
    <header className="topbar">
      {href ? (
        <Link href={href} className="icon-btn" aria-label={close ? "ปิด" : "ย้อนกลับ"}>
          <Icon name={close ? "close" : "back"} stroke={2.2} />
        </Link>
      ) : (
        <span style={{ width: 12 }} />
      )}
      <h1>{title}</h1>
      {right}
    </header>
  );
}

export function PageHead({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
    </header>
  );
}

/** สถานะสำคัญจากหน้า "สถานะและข้อความสำคัญ" ของดีไซน์ */
export function StateCard({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card pad16" role="status" style={{ margin: "16px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
      <p style={{ marginTop: 6, fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>{message}</p>
      {action ? (
        <Link href={action.href} className="btn secondary sm" style={{ marginTop: 14, width: "100%" }}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
