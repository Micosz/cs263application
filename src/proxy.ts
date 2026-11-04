import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "asset_session";
const PUBLIC = /^\/(login|link|liff|dev)(\/|$)/;

/**
 * ด่านแรกก่อนถึงหน้าเว็บ: ถ้าไม่มี cookie session พาไปหน้าเข้าสู่ระบบพร้อม ?next= ของหน้าเดิม
 * (การตรวจ session จริงกับฐานข้อมูลทำในหน้า/Route Handler ทุกครั้ง)
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const here = pathname + search;

  if (!PUBLIC.test(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(here)}`;
    return NextResponse.redirect(url);
  }

  // ส่ง path ปัจจุบันให้ server component ใช้ทำลิงก์ "กลับมาหน้าเดิมหลังล็อกอิน"
  const headers = new Headers(request.headers);
  headers.set("x-pathname", here);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api/|_next/|types/|favicon\\.ico|tu-seal\\.png|robots\\.txt).*)"],
};
