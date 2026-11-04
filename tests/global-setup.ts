import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** สร้างฐานข้อมูลทดสอบใหม่จาก migration จริงในโฟลเดอร์ drizzle/ */
export default async function setup() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* ข้าม */
    }
  }
  const url =
    process.env.DATABASE_URL_TEST ?? "postgres://asset:asset@localhost:5433/asset_tracker_test";
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(`DATABASE_URL_TEST ต้องเป็นฐานข้อมูลที่ชื่อลงท้าย _test (ได้ ${url})`);
  }
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}
