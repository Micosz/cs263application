/**
 * ค่าตั้งค่า LINE ทั้งหมดอ่านจาก environment variables
 * (ชื่อตัวแปรตรงกับ .env.example)
 */
export const lineEnv = {
  /** LINE Login channel → Basic settings → Channel ID (ใช้ตรวจ ID token ทั้งเว็บและ LIFF) */
  loginChannelId: () => process.env.LINE_LOGIN_CHANNEL_ID?.trim() || "",
  /** LINE Login channel → Basic settings → Channel secret (เก็บฝั่ง server เท่านั้น) */
  loginChannelSecret: () => process.env.LINE_LOGIN_CHANNEL_SECRET?.trim() || "",
  /** LINE Login channel → LIFF → LIFF ID (ค่าสาธารณะ ใช้ฝั่งเบราว์เซอร์) */
  liffId: () => process.env.NEXT_PUBLIC_LIFF_ID?.trim() || "",
  /** Messaging API channel → Messaging API → Channel access token (long-lived) */
  messagingToken: () =>
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim() || "",
  /** Messaging API channel → Basic settings → Channel secret (ตรวจลายเซ็น webhook) */
  messagingSecret: () => process.env.LINE_MESSAGING_CHANNEL_SECRET?.trim() || "",
};

export const isLineLoginConfigured = () =>
  !!(lineEnv.loginChannelId() && lineEnv.loginChannelSecret());

export const isMessagingConfigured = () => !!lineEnv.messagingToken();

/** URL หลักของเว็บ เช่น https://asset-tracker.vercel.app (ไม่มี / ท้าย) */
export function appBaseUrl(fallbackOrigin?: string): string {
  const v = process.env.APP_BASE_URL?.trim() || fallbackOrigin || "http://localhost:3000";
  return v.replace(/\/+$/, "");
}

/** Callback URL ที่ต้องลงทะเบียนใน LINE Login channel */
export const lineCallbackUrl = (fallbackOrigin?: string) =>
  `${appBaseUrl(fallbackOrigin)}/api/auth/line/callback`;

/**
 * ลิงก์ที่ปุ่ม "ดูคำขอ" ในข้อความ LINE จะเปิด
 * - มี LIFF ID: เปิดใน LINE ผ่าน LIFF แล้วเข้าสู่ระบบอัตโนมัติ → /requests/:id
 * - ไม่มี: เปิดเว็บตรง (ถ้ายังไม่ล็อกอินจะพาไปล็อกอินแล้วกลับมาที่คำขอเดิม)
 */
export function appLink(path: string, fallbackOrigin?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const liffId = lineEnv.liffId();
  if (liffId) return `https://liff.line.me/${liffId}${p}`;
  return `${appBaseUrl(fallbackOrigin)}${p}`;
}
