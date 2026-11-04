import { defineConfig } from "drizzle-kit";

// drizzle-kit ไม่โหลด .env เอง จึงโหลด .env.local / .env ถ้ามี (Node 20.12+)
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // ไม่มีไฟล์ก็ข้ามไป (เช่น CI หรือเครื่องที่ตั้ง env ไว้แล้ว)
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
