"use client";

import { useEffect, useState } from "react";

/**
 * จุดเข้า LIFF: LINE เปิด https://liff.line.me/{LIFF_ID}/requests/123
 * → endpoint /liff?liff.state=/requests/123 → (LIFF SDK) /liff/requests/123
 * หน้านี้ขอ ID token จาก LIFF ส่งให้ server ตรวจกับ LINE แล้วพาไป /requests/123
 */
export function LiffEntry({ liffId, target }: { liffId: string; target: string }) {
  const [msg, setMsg] = useState("กำลังเปิดในหน้าต่าง LINE…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // liff.state = path ที่ต่อท้าย LIFF URL (ใช้กรณี SDK ยังไม่ redirect รอบสอง)
      const params = new URLSearchParams(window.location.search);
      const state = params.get("liff.state");
      const dest = state && state.startsWith("/") && !/^\/[/\\]/.test(state) && !/^\/liff(\/|\?|$)/.test(state) ? state : target;
      if (!liffId) {
        window.location.replace(`/login?next=${encodeURIComponent(dest)}`);
        return;
      }
      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId });
        if (cancelled) return;
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const idToken = liff.getIDToken();
        if (!idToken) throw new Error("ไม่มี ID token (ตรวจว่า LIFF app เปิด scope openid)");
        setMsg("กำลังยืนยันตัวตนกับ LINE…");
        const res = await fetch("/api/auth/liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        if (data.status === "link") {
          window.location.replace(`/link?next=${encodeURIComponent(dest)}`);
        } else {
          window.location.replace(dest);
        }
      } catch (e) {
        if (cancelled) return;
        setFailed(true);
        setMsg((e as Error).message || "เปิดผ่าน LINE ไม่สำเร็จ");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liffId, target]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, background: "#fff", textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tu-seal.png" alt="" width={56} height={56} />
      <p role="status" style={{ fontSize: 16 }}>{msg}</p>
      {failed ? (
        <a className="btn secondary" style={{ flex: "none", minWidth: 220 }} href={`/login?next=${encodeURIComponent(target)}`}>
          เข้าสู่ระบบผ่านเว็บแทน
        </a>
      ) : null}
    </div>
  );
}
