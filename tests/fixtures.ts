import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assetTypes,
  assets,
  departments,
  reviewRounds,
  rooms,
  users,
  type User,
} from "@/db/schema";

export type Fixture = Awaited<ReturnType<typeof resetFixture>>;

/** ข้อมูลทดสอบขนาดเล็ก: A และ B อยู่สาขาเดียวกัน, M อยู่อีกสาขา */
export async function resetFixture() {
  const db = getDb();
  await db.execute(sql`TRUNCATE notifications, sessions, asset_events, reviews, review_rounds,
    transfer_requests, assets, asset_types, rooms, users, departments RESTART IDENTITY CASCADE`);
  const [cs, math] = await db.insert(departments).values([{ name: "CS" }, { name: "Math" }]).returning();
  const [A, B, C, M] = await db
    .insert(users)
    .values([
      { username: "a", fullName: "คุณเอ ทดสอบ", departmentId: cs.id, lineUserId: "U-line-a", lineDisplayName: "A" },
      { username: "b", fullName: "คุณบี ทดสอบ", departmentId: cs.id, lineUserId: "U-line-b", lineDisplayName: "B" },
      { username: "c", fullName: "คุณซี ทดสอบ", departmentId: cs.id },
      { username: "m", fullName: "คุณเอ็ม คณิต", departmentId: math.id },
    ])
    .returning();
  await db.insert(assetTypes).values([{ key: "laptop", label: "โน้ตบุ๊ก" }]);
  const [r101, r102, rM] = await db
    .insert(rooms)
    .values([
      { code: "101", departmentId: cs.id },
      { code: "102", departmentId: cs.id },
      { code: "M1", departmentId: math.id },
    ])
    .returning();
  const [laptop, laptop2, mathAsset] = await db
    .insert(assets)
    .values([
      { code: "L-001", name: "โน้ตบุ๊ก ทดสอบ 1", typeKey: "laptop", roomId: r101.id, custodianId: A.id },
      { code: "L-002", name: "โน้ตบุ๊ก ทดสอบ 2", typeKey: "laptop", roomId: r101.id, custodianId: A.id },
      { code: "M-001", name: "โน้ตบุ๊ก สาขาอื่น", typeKey: "laptop", roomId: rM.id, custodianId: M.id },
    ])
    .returning();
  const now = Date.now();
  await db.insert(reviewRounds).values({
    name: "รอบทดสอบ",
    startsAt: new Date(now - 86400_000),
    endsAt: new Date(now + 86400_000),
  });
  return { A, B, C, M, r101, r102, rM, laptop, laptop2, mathAsset };
}

export async function reloadUser(u: User) {
  const [x] = await getDb().select().from(users).where(eq(users.id, u.id));
  return x;
}

export async function assetRow(id: string) {
  const [x] = await getDb().select().from(assets).where(eq(assets.id, id));
  return x;
}

let n = 0;
export const key = () => `test-key-${Date.now()}-${++n}`;
