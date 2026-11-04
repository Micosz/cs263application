/**
 * รับเฉพาะ path ภายในเว็บนี้ (กัน open redirect เช่น //evil.com หรือ https://evil.com)
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  if (/[\r\n]/.test(next)) return fallback;
  // ไม่พากลับไปหน้าล็อกอิน/เชื่อมบัญชีซ้ำ
  if (/^\/(login|link|liff)(\/|\?|$)/.test(next)) return fallback;
  return next;
}
