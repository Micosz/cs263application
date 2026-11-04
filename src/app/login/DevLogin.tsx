"use client";

import { Avatar } from "@/components/bits";
import { usePost } from "@/components/client";

type U = { username: string; fullName: string; position: string; avatarBg: string; avatarFg: string; tag?: string };

/** สลับผู้ใช้ตัวอย่าง — แสดงและทำงานเฉพาะ development */
export function DevLogin({ users, next }: { users: U[]; next: string }) {
  const post = usePost();
  return (
    <section className="dev-box" aria-labelledby="dev-title">
      <h2 id="dev-title">ผู้ใช้ตัวอย่าง (เฉพาะ development)</h2>
      <p className="meta" style={{ marginTop: 2 }}>
        ใช้ทดลองขั้นตอนส่งต่อในเครื่องโดยไม่ต้องมี LINE — ปุ่มนี้ไม่มีใน production build
      </p>
      <div className="list" style={{ margin: "10px 0 0" }}>
        {users.map((u) => (
          <button
            key={u.username}
            type="button"
            className="pick-row"
            disabled={post.pending}
            onClick={async () => {
              if (await post.run("/api/dev/login", { username: u.username })) window.location.href = next;
            }}
          >
            <Avatar person={u} size={40} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
              <span style={{ fontWeight: 600 }}>
                {u.tag ? <b style={{ color: "var(--red)" }}>{u.tag} · </b> : null}
                {u.fullName}
              </span>
              <span className="meta">
                {u.username} · {u.position}
              </span>
            </span>
          </button>
        ))}
      </div>
      {post.error ? <p className="field-error" style={{ marginTop: 8 }}>{post.error.error}</p> : null}
    </section>
  );
}
