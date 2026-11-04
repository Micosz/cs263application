import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { lineCallbackUrl } from "@/lib/line/config";
import { exchangeCode, verifyIdToken } from "@/lib/line/login";
import { completeLineLogin } from "@/lib/line-session";
import { takeOAuthState } from "@/lib/session";

/** LINE พากลับมาที่นี่หลังผู้ใช้ยอมรับ (ต้องลงทะเบียน URL นี้เป็น Callback URL ใน LINE Login channel) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const go = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);
  const st = await takeOAuthState();
  const next = st?.next ?? "/";
  const withNext = (base: string) => `${base}${base.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`;

  if (url.searchParams.get("error")) return go(withNext("/login?error=cancelled"));
  const code = url.searchParams.get("code");
  if (!st || !code || url.searchParams.get("state") !== st.state) {
    return go(withNext("/login?error=state"));
  }
  try {
    const idToken = await exchangeCode({ code, redirectUri: lineCallbackUrl(url.origin), codeVerifier: st.verifier });
    const identity = await verifyIdToken(idToken, st.nonce);
    const r = await completeLineLogin(identity, "line");
    if (r.status === "link") return go(withNext("/link"));
    if (r.status === "linked") return go("/account?linked=1");
    return go(next);
  } catch (e) {
    console.error("LINE login failed", e);
    if (e instanceof AppError && e.code === "line_taken") return go("/account?error=line_taken");
    return go(withNext("/login?error=line_failed"));
  }
}
