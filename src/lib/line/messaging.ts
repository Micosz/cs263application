import { createHmac, timingSafeEqual } from "node:crypto";
import { lineEnv } from "./config";

const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

export type LineMessage = Record<string, unknown>;

export type SendResult = {
  ok: boolean;
  status: number | null;
  error?: string;
};

async function post(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<SendResult> {
  const token = lineEnv.messagingToken();
  if (!token) {
    return {
      ok: false,
      status: null,
      error: "ยังไม่ได้ตั้งค่า LINE_MESSAGING_CHANNEL_ACCESS_TOKEN",
    };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) return { ok: true, status: res.status };
    const text = await res.text().catch(() => "");
    // 409 + retry key เดิม = LINE รับข้อความนี้ไปแล้วก่อนหน้า ไม่ได้ส่งซ้ำ
    if (res.status === 409 && extraHeaders["X-Line-Retry-Key"]) {
      return { ok: true, status: res.status };
    }
    return { ok: false, status: res.status, error: text.slice(0, 500) || res.statusText };
  } catch (e) {
    return {
      ok: false,
      status: null,
      error: `เชื่อมต่อ LINE ไม่ได้: ${(e as Error).message}`.slice(0, 500),
    };
  }
}

/** ส่งข้อความถึงผู้ใช้ 1 คน (Messaging API push) */
export function pushMessage(to: string, messages: LineMessage[], retryKey: string) {
  return post(PUSH_URL, { to, messages }, { "X-Line-Retry-Key": retryKey });
}

export function replyMessage(replyToken: string, messages: LineMessage[]) {
  return post(REPLY_URL, { replyToken, messages });
}

/** ตรวจ X-Line-Signature ของ webhook */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = lineEnv.messagingSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
