import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** ใช้ได้ทั้ง db หลักและ tx ใน transaction */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

type GlobalDb = { __assetPool?: Pool; __assetDb?: Db };
const g = globalThis as unknown as GlobalDb;

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า DATABASE_URL (ดู .env.example และ README หัวข้อเตรียมฐานข้อมูล)",
    );
  }
  return new Pool({
    connectionString: url,
    // serverless (Vercel) ควรใช้ connection น้อย ๆ และใช้ pooled connection string ของผู้ให้บริการ
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
  });
}

export function getDb(): Db {
  if (!g.__assetDb) {
    g.__assetPool = createPool();
    g.__assetDb = drizzle(g.__assetPool, { schema });
  }
  return g.__assetDb;
}

export async function closeDb() {
  const pool = g.__assetPool;
  g.__assetPool = undefined;
  g.__assetDb = undefined;
  if (pool) await pool.end();
}

export { schema };
