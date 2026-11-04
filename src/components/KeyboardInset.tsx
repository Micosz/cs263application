"use client";

import { useEffect } from "react";

/**
 * วัดความสูงคีย์บอร์ดบนมือถือ (iOS ไม่ย่อ layout viewport เอง) แล้วตั้ง --kb-inset
 * ให้แถบปุ่มยืนยันและแผ่นยืนยันขยับขึ้นเหนือคีย์บอร์ด
 */
export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb-inset", `${Math.round(inset)}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return null;
}
