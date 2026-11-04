import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/db";
import { POST } from "@/app/api/dev/login/route";
import { isDevLoginEnabled } from "@/lib/auth";

afterEach(() => vi.unstubAllEnvs());
afterAll(closeDb);

describe("สลับผู้ใช้ตัวอย่างใช้ได้เฉพาะ development", () => {
  it("production ตอบ 404 และไม่สร้าง session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevLoginEnabled()).toBe(false);
    const res = await POST(
      new Request("http://localhost/api/dev/login", {
        method: "POST",
        body: JSON.stringify({ username: "a" }),
      }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("development เปิดใช้", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isDevLoginEnabled()).toBe(true);
  });
});
