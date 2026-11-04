import { NextResponse } from "next/server";
import { randomToken } from "@/lib/crypto";
import { isLineLoginConfigured, lineCallbackUrl } from "@/lib/line/config";
import { buildAuthorizeUrl } from "@/lib/line/login";
import { safeNext } from "@/lib/safe-next";
import { setOAuthState } from "@/lib/session";

/** เริ่ม LINE Login บนเบราว์เซอร์ (คอม / มือถือนอกแอป LINE) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  if (!isLineLoginConfigured()) {
    return NextResponse.redirect(
      new URL(`/login?error=line_not_configured&next=${encodeURIComponent(next)}`, req.url),
      303,
    );
  }
  const state = randomToken(16);
  const nonce = randomToken(16);
  const verifier = randomToken(48);
  await setOAuthState({ state, nonce, verifier, next });
  const authorize = buildAuthorizeUrl({
    redirectUri: lineCallbackUrl(url.origin),
    state,
    nonce,
    codeVerifier: verifier,
  });
  return NextResponse.redirect(authorize, 303);
}
