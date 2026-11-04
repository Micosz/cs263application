import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* ไม่มีไฟล์ก็ข้าม */
  }
}

// ใช้ฐานข้อมูลแยกสำหรับทดสอบเสมอ (ล้างข้อมูลทุกครั้ง)
const testDb =
  process.env.DATABASE_URL_TEST ?? "postgres://asset:asset@localhost:5433/asset_tracker_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      DATABASE_URL: testDb,
      SESSION_SECRET: "test-secret-0123456789abcdef0123456789",
      APP_BASE_URL: "https://asset.example.test",
      LINE_LOGIN_CHANNEL_ID: "1234567890",
      LINE_LOGIN_CHANNEL_SECRET: "test-login-secret",
      NEXT_PUBLIC_LIFF_ID: "1234567890-AbCdEfGh",
      LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "",
      LINE_MESSAGING_CHANNEL_SECRET: "test-messaging-secret",
    },
  },
});
