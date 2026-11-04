"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ApiError = { error: string; code?: string; status: number };

/** เรียก API แบบ POST JSON; กันกดซ้ำระหว่างรอ และคืนข้อความ error ภาษาไทยจาก server */
export function usePost<T = unknown>() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const busy = useRef(false);

  const run = useCallback(async (url: string, body?: unknown): Promise<T | null> => {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({
          error: data.error ?? "ทำรายการไม่สำเร็จ",
          code: data.code,
          status: res.status,
        });
        return null;
      }
      return data as T;
    } catch {
      setError({
        error: "ยังยืนยันผลการบันทึกไม่ได้ ตรวจสอบสถานะเมื่อเชื่อมต่อได้อีกครั้ง ก่อนทำซ้ำ",
        code: "network",
        status: 0,
      });
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);

  return { run, pending, error, setError };
}

/** รหัสรายการต่อหนึ่งฟอร์ม ใช้กันบันทึกซ้ำเมื่อกดยืนยันซ้ำหรือเน็ตหลุดแล้วส่งใหม่ */
export function useIdempotencyKey() {
  const [key] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  return key;
}

export function useRefresh() {
  const router = useRouter();
  return router.refresh;
}

/** แผ่นยืนยันจากล่างจอ (มือถือ) / กล่องกลางจอ (คอม) */
export function Sheet({
  open,
  onClose,
  label,
  children,
  full,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button, input, textarea, a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className={`sheet${full ? " full" : ""}`}>
        {full ? null : <span className="grabber" aria-hidden="true" />}
        {children}
      </div>
    </div>
  );
}
