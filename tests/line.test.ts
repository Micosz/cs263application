import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/db";
import { notifications, users } from "@/db/schema";
import { appLink } from "@/lib/line/config";
import { verifyIdToken } from "@/lib/line/login";
import { verifyWebhookSignature } from "@/lib/line/messaging";
import { safeNext } from "@/lib/safe-next";
import { acceptTransfer, createTransfer } from "@/services/commands";
import { resendRequestNotification, sendTransferNotification } from "@/services/notify";
import { listRequests } from "@/services/queries";
import { key, resetFixture, type Fixture } from "./fixtures";

let f: Fixture;
beforeEach(async () => {
  f = await resetFixture();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(closeDb);

const newRequest = async () =>
  (await createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.B.id, reason: "ส่งต่องาน", idempotencyKey: key() })).request;

const rowsFor = (requestId: string) =>
  getDb().select().from(notifications).where(eq(notifications.requestId, requestId));

describe("แจ้งเตือน LINE เมื่อ A ส่งคำขอถึง B", () => {
  it("ส่งข้อความ push ถึง B พร้อมชื่อครุภัณฑ์และปุ่ม ดูคำขอ ที่เปิดคำขอนั้นโดยตรง", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "token-123");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const req = await newRequest();

    const out = await sendTransferNotification(req.id, "transfer_requested");
    expect(out.status).toBe("sent");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-123");
    expect(headers["X-Line-Retry-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    const body = JSON.parse(String(init.body));
    expect(body.to).toBe("U-line-b");
    const text = JSON.stringify(body.messages[0]);
    expect(text).toContain("โน้ตบุ๊ก ทดสอบ 1");
    const button = body.messages[0].contents.footer.contents[0];
    expect(button.action).toEqual({
      type: "uri",
      label: "ดูคำขอ",
      uri: `https://liff.line.me/1234567890-AbCdEfGh/requests/${req.id}`,
    });

    // เรียกซ้ำไม่ส่งซ้ำ
    await sendTransferNotification(req.id, "transfer_requested");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [row] = await rowsFor(req.id);
    expect(row).toMatchObject({ status: "sent", attempts: 1, httpStatus: 200 });
  });

  it("ส่งไม่สำเร็จ: เก็บคำขอไว้ให้ B เปิดจากเว็บได้ และบันทึกผลการส่งตามจริง", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "token-123");
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"Internal error"}', { status: 500 })));
    const req = await newRequest();
    const out = await sendTransferNotification(req.id, "transfer_requested");
    expect(out.status).toBe("failed");
    const [row] = await rowsFor(req.id);
    expect(row).toMatchObject({ status: "failed", httpStatus: 500, attempts: 1 });
    expect(row.error).toContain("Internal error");
    expect((await listRequests(f.B)).incomingPending.map((r) => r.id)).toEqual([req.id]);

    // ส่งอีกครั้งด้วย retry key เดิม
    const fetchOk = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchOk);
    const again = await resendRequestNotification(f.A, req.id);
    expect(again.status).toBe("sent");
    const [after] = await rowsFor(req.id);
    expect(after.attempts).toBe(2);
    expect((fetchOk.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ "X-Line-Retry-Key": row.retryKey });
  });

  it("ยังไม่ตั้งค่า token หรือผู้รับยังไม่เชื่อม LINE: ข้ามการส่งและบันทึกเหตุผล", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = await newRequest();
    const out = await sendTransferNotification(req.id, "transfer_requested");
    expect(out).toMatchObject({ status: "skipped", error: "ยังไม่ได้ตั้งค่า LINE_MESSAGING_CHANNEL_ACCESS_TOKEN" });

    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "token-123");
    await getDb().update(users).set({ lineUserId: null }).where(eq(users.id, f.B.id));
    const out2 = await sendTransferNotification(req.id, "transfer_requested");
    expect(out2).toMatchObject({ status: "skipped", error: "ผู้รับยังไม่เชื่อม LINE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("แจ้งผลถึง A เมื่อ B ตอบรับ", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "token-123");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const req = await newRequest();
    await acceptTransfer(f.B, req.id);
    const out = await sendTransferNotification(req.id, "transfer_accepted");
    expect(out.status).toBe("sent");
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.to).toBe("U-line-a");
    expect(body.messages[0].altText).toContain("รับ");
  });
});

describe("LINE login / webhook / ลิงก์", () => {
  it("server ตรวจ ID token กับ LINE ก่อนเชื่อ", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ sub: "U-real", aud: "1234567890", name: "Real User" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const id = await verifyIdToken("id.token.value", "nonce-1");
    expect(id).toEqual({ sub: "U-real", name: "Real User", picture: undefined });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.line.me/oauth2/v2.1/verify");
    expect(String(init.body)).toContain("client_id=1234567890");
    expect(String(init.body)).toContain("nonce=nonce-1");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error_description: "IdToken expired." }), { status: 400 })));
    await expect(verifyIdToken("bad")).rejects.toThrow("IdToken expired.");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ sub: "U", aud: "other" }), { status: 200 })));
    await expect(verifyIdToken("x")).rejects.toThrow("ไม่ได้ออกให้ channel นี้");
  });

  it("ตรวจลายเซ็น webhook", () => {
    const body = '{"events":[]}';
    const sig = createHmac("sha256", "test-messaging-secret").update(body).digest("base64");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig)).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("ลิงก์ในข้อความใช้ LIFF ถ้ามี LIFF ID ไม่งั้นเปิดเว็บตรง", () => {
    expect(appLink("/requests/1")).toBe("https://liff.line.me/1234567890-AbCdEfGh/requests/1");
    vi.stubEnv("NEXT_PUBLIC_LIFF_ID", "");
    expect(appLink("/requests/1")).toBe("https://asset.example.test/requests/1");
  });

  it("กลับไปหน้าเดิมหลังล็อกอินได้เฉพาะ path ภายในเว็บ", () => {
    expect(safeNext("/requests/abc")).toBe("/requests/abc");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/login?next=/x")).toBe("/");
    expect(safeNext(undefined, "/mine")).toBe("/mine");
  });
});
