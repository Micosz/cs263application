import { createHash } from "node:crypto";
import { lineEnv } from "./config";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export type LineIdentity = {
  /** LINE userId */
  sub: string;
  name: string;
  picture?: string;
};

export class LineAuthError extends Error {}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}) {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", lineEnv.loginChannelId());
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("scope", "profile openid");
  u.searchParams.set("nonce", opts.nonce);
  u.searchParams.set("code_challenge", pkceChallenge(opts.codeVerifier));
  u.searchParams.set("code_challenge_method", "S256");
  // ชวนเพิ่มเพื่อน LINE OA (ต้องลิงก์ OA กับ LINE Login channel ก่อน) เพื่อให้รับข้อความแจ้งเตือนได้
  u.searchParams.set("bot_prompt", "aggressive");
  return u.toString();
}

/** แลก authorization code เป็น ID token (server-to-server กับ LINE) */
export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: lineEnv.loginChannelId(),
      client_secret: lineEnv.loginChannelSecret(),
      code_verifier: opts.codeVerifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id_token?: string;
    error_description?: string;
  };
  if (!res.ok || !body.id_token) {
    throw new LineAuthError(
      `แลก code กับ LINE ไม่สำเร็จ (${res.status}) ${body.error_description ?? ""}`.trim(),
    );
  }
  return body.id_token;
}

/**
 * ตรวจ ID token กับ LINE โดยตรง (ใช้ทั้ง LINE Login บนเว็บและ LIFF)
 * LINE ตรวจลายเซ็น ผู้ออก อายุ และ client_id ให้ แล้วคืนข้อมูลผู้ใช้
 */
export async function verifyIdToken(
  idToken: string,
  nonce?: string,
): Promise<LineIdentity> {
  const clientId = lineEnv.loginChannelId();
  if (!clientId) throw new LineAuthError("ยังไม่ได้ตั้งค่า LINE_LOGIN_CHANNEL_ID");
  const params = new URLSearchParams({ id_token: idToken, client_id: clientId });
  if (nonce) params.set("nonce", nonce);
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    sub?: string;
    aud?: string;
    name?: string;
    picture?: string;
    error_description?: string;
  };
  if (!res.ok || !body.sub) {
    throw new LineAuthError(
      `LINE ไม่ยืนยัน ID token (${res.status}) ${body.error_description ?? ""}`.trim(),
    );
  }
  if (body.aud && body.aud !== clientId) {
    throw new LineAuthError("ID token ไม่ได้ออกให้ channel นี้");
  }
  return { sub: body.sub, name: body.name ?? "LINE", picture: body.picture };
}
