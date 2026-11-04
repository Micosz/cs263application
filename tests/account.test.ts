import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { users } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { signPayload, verifyPayload } from "@/lib/crypto";
import { linkWithCode, normalizeLinkCode } from "@/services/account";
import { reloadUser, resetFixture, type Fixture } from "./fixtures";

let f: Fixture;
beforeEach(async () => {
  f = await resetFixture();
  await getDb()
    .update(users)
    .set({ linkCodeHash: sha256(normalizeLinkCode("ABCD-2345")), linkCodeExpiresAt: new Date(Date.now() + 3600_000) })
    .where(eq(users.id, f.C.id));
});
afterAll(closeDb);

describe("ผูก LINE กับบัญชีในระบบ", () => {
  it("รหัสถูก: ผูก LINE userId ที่ LINE ยืนยันแล้ว และใช้รหัสซ้ำไม่ได้", async () => {
    const r = await linkWithCode({ sub: "U-c-real", name: "C on LINE" }, { username: "c", code: "abcd2345" });
    expect(r.ok).toBe(true);
    const c = await reloadUser(f.C);
    expect(c).toMatchObject({ lineUserId: "U-c-real", lineDisplayName: "C on LINE", linkCodeHash: null });
    const again = await linkWithCode({ sub: "U-other", name: "x" }, { username: "c", code: "ABCD-2345" });
    expect(again.ok).toBe(false);
  });

  it("รหัสผิดนับจำนวนครั้ง และล็อกเมื่อผิดเกิน 5 ครั้ง", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await linkWithCode({ sub: "U-x", name: "x" }, { username: "c", code: "WRONG-000" });
      expect(r.ok).toBe(false);
    }
    await expect(linkWithCode({ sub: "U-x", name: "x" }, { username: "c", code: "ABCD-2345" })).rejects.toThrow("ขอรหัสใหม่");
  });

  it("LINE เดียวผูกได้กับผู้ใช้คนเดียว", async () => {
    const r = await linkWithCode({ sub: "U-line-a", name: "A" }, { username: "c", code: "ABCD-2345" });
    expect(r.ok).toBe(false);
  });

  it("cookie ชั่วคราวที่เซ็นแล้วแก้ไขไม่ได้", () => {
    const t = signPayload({ sub: "U1" }, 60);
    expect(verifyPayload<{ sub: string }>(t)?.sub).toBe("U1");
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "U2", exp: 9e9 })).toString("base64url");
    expect(verifyPayload(`${forged}.${sig}`)).toBeNull();
    expect(verifyPayload(`${body}.x${sig}`)).toBeNull();
  });
});
