import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (s: string) =>
  createHash("sha256").update(s).digest("hex");

export const randomToken = (bytes = 32) =>
  randomBytes(bytes).toString("base64url");

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET ต้องตั้งค่าและยาวอย่างน้อย 32 ตัวอักษร");
  }
  return s;
}

/** เซ็นข้อมูลสั้น ๆ เก็บใน cookie ชั่วคราว (state ของ LINE Login, ตัวตน LINE ที่ยังไม่เชื่อม) */
export function signPayload(data: object, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPayload<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data as T;
  } catch {
    return null;
  }
}
