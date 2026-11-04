"use client";

import { useState } from "react";
import { usePost } from "@/components/client";
import { Icon } from "@/components/Icon";

/** W1 · เชื่อม LINE กับบัญชีของคุณ */
export function LinkForm({ lineName, next }: { lineName: string; next: string }) {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const post = usePost<{ fullName: string }>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!username.trim() || !code.trim()) return;
    const r = await post.run("/api/auth/link", { username, code });
    if (r) setDone(r.fullName);
  }

  if (done) {
    return (
      <>
        <div className="done" role="status" style={{ flex: 1 }}>
          <h2><Icon name="check" size={26} stroke={2.8} color="#2F7A3A" />เชื่อมบัญชีแล้ว</h2>
          <p>จะเริ่มแจ้งเตือนทาง LINE ตั้งแต่ตอนนี้</p>
          <div className="card" style={{ padding: "14px 16px" }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{done}</span>
            <span className="meta" style={{ display: "block" }}>เชื่อมกับ LINE {lineName}</span>
          </div>
        </div>
        <div className="actionbar">
          <a href={next} className="btn">ไปต่อ</a>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", flex: 1 }} noValidate>
      <div style={{ flex: 1, padding: "20px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 4px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tu-seal.png" alt="ตรามหาวิทยาลัยธรรมศาสตร์" width={44} height={44} style={{ objectFit: "contain" }} />
          <span style={{ fontSize: 14.5, lineHeight: 1.4 }} className="muted">ระบบติดตามครุภัณฑ์<br />สาขาวิชาวิทยาการคอมพิวเตอร์</span>
        </div>
        <h1 style={{ margin: "18px 4px 0", fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>เชื่อม LINE กับบัญชีของคุณ</h1>
        <p style={{ margin: "6px 4px 0", fontSize: 15.5, lineHeight: 1.55 }} className="muted">
          ทำครั้งเดียว หลังจากนี้กดปุ่มในแชทแล้วเข้าดูของคุณได้ทันที
        </p>
        <div className="card" style={{ marginTop: 16, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="muted" style={{ display: "flex" }}><Icon name="chat" /></span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", lineHeight: 1.4 }}>
            <span style={{ fontSize: 13 }} className="muted">บัญชี LINE นี้</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{lineName}</span>
          </span>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="field">
            <span>ชื่อผู้ใช้ TU</span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              placeholder="เช่น aree.s"
              aria-invalid={touched && !username.trim()}
            />
          </label>
          <label className="field">
            <span>รหัสเชื่อมบัญชี</span>
            <input
              className="input mono"
              style={{ fontSize: 18, letterSpacing: 2, color: "var(--ink)" }}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="characters"
              autoComplete="one-time-code"
              placeholder="ABCD-2345"
              aria-invalid={touched && !code.trim()}
            />
          </label>
          {touched && (!username.trim() || !code.trim()) ? <p className="field-error">กรอกชื่อผู้ใช้ TU และรหัสเชื่อมบัญชี</p> : null}
          {post.error ? <p className="field-error" role="alert">{post.error.error}</p> : null}
        </div>
        <p className="note" style={{ margin: "14px 4px 0", fontSize: 14 }}>
          <Icon name="info" size={18} />
          <span>รหัสเชื่อมบัญชีได้จากผู้ดูแลระบบ ใช้ได้ครั้งเดียว ระบบไม่ขอรหัสผ่านทางข้อความในแชท ยกเลิกการเชื่อมได้ทุกเมื่อในหน้าบัญชี</span>
        </p>
      </div>
      <div className="actionbar">
        <button type="submit" className="btn" disabled={post.pending}>
          {post.pending ? "กำลังเชื่อม…" : "เชื่อมบัญชี"}
        </button>
      </div>
    </form>
  );
}
