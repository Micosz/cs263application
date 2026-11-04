/**
 * ข้อมูลตัวอย่างสำหรับทดสอบ (ชื่อบุคคลเป็นชื่อสมมติทั้งหมด)
 * ล้างข้อมูลเดิมแล้วใส่ใหม่ทุกครั้ง: npm run db:seed
 */
import { assertSafeTarget } from "./_env";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/db";
import {
  assetEvents,
  assetTypes,
  assets,
  departments,
  reviewRounds,
  reviews,
  rooms,
  transferRequests,
  users,
} from "../src/db/schema";

assertSafeTarget("seed");

const d = (s: string) => new Date(`${s}+07:00`);

async function main() {
  const db = getDb();
  await db.execute(sql`TRUNCATE notifications, sessions, asset_events, reviews, review_rounds,
    transfer_requests, assets, asset_types, rooms, users, departments RESTART IDENTITY CASCADE`);

  const [cs, math] = await db
    .insert(departments)
    .values([{ name: "สาขาวิชาวิทยาการคอมพิวเตอร์" }, { name: "สาขาวิชาคณิตศาสตร์และสถิติ" }])
    .returning();

  // A = คุณอารีย์ (aree.s), B = คุณบุญมี (boonmee.k) ใช้ทดสอบการส่งต่อ
  const people = [
    ["aree.s", "คุณอารีย์ สุขใจ", "นักวิชาการคอมพิวเตอร์", "#DCE6F0", "#24506E", "staff", "Aree S."],
    ["boonmee.k", "คุณบุญมี กล้าหาญ", "เจ้าหน้าที่ระบบงานคอมพิวเตอร์", "#E7DFF0", "#563A72", "staff", "Boonmee K."],
    ["napha.s", "คุณนภา ศรีสุข", "เจ้าหน้าที่ระบบงานคอมพิวเตอร์", "#F2E3D6", "#7A4318", "staff", "Napha"],
    ["pimchanok.t", "คุณพิมพ์ชนก แสงทอง", "เจ้าหน้าที่ระบบงานคอมพิวเตอร์ปฏิบัติการ", "#DDEBDD", "#2F5E33", "staff", "Pimchanok"],
    ["kanda.w", "คุณกานดา วงศ์ดี", "นักวิชาการคอมพิวเตอร์ชำนาญการพิเศษ", "#F0DDE2", "#85243C", "admin", "Kanda W."],
    ["chanida.b", "คุณชนิดา บุญมาก", "นักวิชาการคอมพิวเตอร์ชำนาญการพิเศษ", "#E3E3EA", "#3A3A48", "staff", "Chanida"],
    ["somsak.m", "คุณสมศักดิ์ มั่นคง", "เจ้าหน้าที่บริหารงานทั่วไปชำนาญการ", "#DCECEE", "#245F66", "staff", null],
  ] as const;
  const inserted = await db
    .insert(users)
    .values([
      ...people.map(([username, fullName, position, avatarBg, avatarFg, role, lineName]) => ({
        username,
        fullName,
        position,
        avatarBg,
        avatarFg,
        role,
        departmentId: cs.id,
        // LINE userId สมมติ (ยังไม่ใช่บัญชีจริง) — ผูกบัญชีจริงด้วย npm run link-code ภายหลัง
        lineUserId: lineName ? `Udemo-${username}` : null,
        lineDisplayName: lineName,
        lineLinkedAt: lineName ? d("2026-08-01T09:00:00") : null,
      })),
      {
        username: "theerapong.r",
        fullName: "คุณธีรพงษ์ เรียนดี",
        position: "นักวิทยาศาสตร์",
        departmentId: math.id,
        avatarBg: "#E3E3EA",
        avatarFg: "#3A3A48",
      },
    ])
    .returning();
  const U = Object.fromEntries(inserted.map((u) => [u.username, u.id])) as Record<string, string>;

  await db.insert(assetTypes).values([
    { key: "desktop", label: "คอมพิวเตอร์", sort: 1 },
    { key: "monitor", label: "จอภาพ", sort: 2 },
    { key: "laptop", label: "โน้ตบุ๊ก", sort: 3 },
    { key: "chair", label: "เก้าอี้", sort: 4 },
    { key: "projector", label: "โปรเจกเตอร์", sort: 5 },
    { key: "printer", label: "เครื่องพิมพ์", sort: 6 },
    { key: "ups", label: "เครื่องสำรองไฟ", sort: 7 },
  ]);

  const roomRows = await db
    .insert(rooms)
    .values([
      { code: "213", name: "ห้องเจ้าหน้าที่", departmentId: cs.id },
      { code: "217", name: "", departmentId: cs.id },
      { code: "304", name: "ห้องปฏิบัติการคอมพิวเตอร์", departmentId: cs.id },
      { code: "305", name: "ห้องประชุม", departmentId: cs.id },
      { code: "401", name: "ห้องเรียน", departmentId: cs.id },
      { code: "405", name: "ห้องปฏิบัติการคอมพิวเตอร์", departmentId: cs.id },
      { code: "M101", name: "ห้องพักอาจารย์", departmentId: math.id },
    ])
    .returning();
  const R = Object.fromEntries(roomRows.map((r) => [r.code, r.id])) as Record<string, number>;

  // [เลขครุภัณฑ์, ชื่อ, ประเภท, ห้อง, ผู้รับผิดชอบ, วันที่ทบทวนในรอบนี้]
  const list: [string, string, string, string, string, string | null][] = [
    ["7440-001-0012/66", "โน้ตบุ๊ก Dell Latitude 5440", "laptop", "217", "aree.s", null],
    ["7440-005-0011/67", "จอภาพ Dell P2422H", "monitor", "217", "aree.s", null],
    ["7110-006-0102/62", "เก้าอี้สำนักงาน", "chair", "217", "aree.s", null],
    ["7430-003-0021/63", "เครื่องพิมพ์ Brother HL-L2370", "printer", "217", "aree.s", "2026-10-28T10:05:00"],
    ["7440-001-0013/66", "โน้ตบุ๊ก Dell Latitude 5440", "laptop", "217", "aree.s", "2026-10-28T10:07:00"],
    ["7440-005-0012/67", "จอภาพ Dell P2422H", "monitor", "217", "aree.s", "2026-10-28T10:09:00"],
    ["7110-006-0103/62", "เก้าอี้สำนักงาน", "chair", "217", "aree.s", "2026-10-28T10:10:00"],
    ["7440-002-0231/65", "คอมพิวเตอร์ Lenovo ThinkCentre M70s", "desktop", "217", "aree.s", "2026-10-29T09:30:00"],
    ["6130-007-0020/64", "เครื่องสำรองไฟ APC 1000VA", "ups", "217", "aree.s", "2026-10-29T09:32:00"],
    ["6730-004-0003/63", "โปรเจกเตอร์ Epson EB-X51", "projector", "304", "aree.s", null],
    ["6130-007-0019/64", "เครื่องสำรองไฟ APC 1000VA", "ups", "304", "aree.s", null],
    ["7440-002-0230/65", "คอมพิวเตอร์ Lenovo ThinkCentre M70s", "desktop", "213", "aree.s", "2026-10-15T14:00:00"],
    ["7440-005-0003/67", "จอภาพ Dell P2422H", "monitor", "213", "boonmee.k", "2026-10-14T11:00:00"],
    ["7110-006-0046/62", "เก้าอี้สำนักงาน", "chair", "213", "boonmee.k", "2026-10-14T11:02:00"],
    ["7440-001-0020/66", "โน้ตบุ๊ก Dell Latitude 5440", "laptop", "401", "boonmee.k", null],
    ["7110-006-0045/62", "เก้าอี้สำนักงาน", "chair", "213", "pimchanok.t", null],
    ["7440-002-0101/64", "คอมพิวเตอร์ Lenovo ThinkCentre M70s", "desktop", "405", "chanida.b", "2026-10-09T13:00:00"],
    ["7440-002-0102/64", "คอมพิวเตอร์ Lenovo ThinkCentre M70s", "desktop", "405", "chanida.b", null],
    ["7440-001-0102/66", "โน้ตบุ๊ก Lenovo ThinkPad E14 Gen 5 (Intel Core i7 / RAM 32GB) สำหรับงานประมวลผลข้อมูลวิจัยและสอนปฏิบัติการ", "laptop", "405", "chanida.b", null],
    ["7440-005-0020/67", "จอภาพ Dell P2422H", "monitor", "405", "chanida.b", null],
    ["6730-004-0007/65", "โปรเจกเตอร์ Sony VPL-EX", "projector", "304", "napha.s", "2026-10-26T15:00:00"],
    ["7430-003-0030/63", "เครื่องพิมพ์ HP LaserJet M211", "printer", "305", "kanda.w", null],
    ["6730-004-0010/66", "โปรเจกเตอร์ Epson EB-X51", "projector", "305", "kanda.w", null],
    ["6130-007-0031/64", "เครื่องสำรองไฟ APC 1000VA", "ups", "305", "somsak.m", null],
    ["7440-001-0101/66", "โน้ตบุ๊ก Lenovo ThinkPad E14", "laptop", "M101", "theerapong.r", null],
  ];
  const assetRows = await db
    .insert(assets)
    .values(
      list.map(([code, name, typeKey, room, who]) => ({
        code,
        name,
        typeKey,
        roomId: R[room],
        custodianId: U[who],
        createdAt: d("2026-01-10T09:00:00"),
      })),
    )
    .returning();
  const A = Object.fromEntries(assetRows.map((a) => [a.code, a])) as Record<string, (typeof assetRows)[number]>;

  const [round1, round2] = await db
    .insert(reviewRounds)
    .values([
      { name: "รอบ 1/2569", startsAt: d("2026-07-01T00:00:00"), endsAt: d("2026-07-31T23:59:59") },
      { name: "รอบ 2/2569", startsAt: d("2026-10-01T00:00:00"), endsAt: d("2026-11-30T23:59:59") },
      { name: "รอบ 1/2570", startsAt: d("2027-02-01T00:00:00"), endsAt: d("2027-02-28T23:59:59") },
    ])
    .returning();

  // ผลทบทวนรอบที่แล้ว (ทุกชิ้นของ A เจอและใช้งานได้ 20 ก.ค.)
  const prev = list.filter((x) => x[4] === "aree.s" && x[3] !== "304");
  for (const [code, , , room] of prev) {
    const at = d("2026-07-20T10:00:00");
    await db.insert(reviews).values({ roundId: round1.id, assetId: A[code].id, reviewerId: U["aree.s"], result: "ok", createdAt: at, updatedAt: at });
    await db.insert(assetEvents).values({
      assetId: A[code].id, kind: "reviewed", actorId: U["aree.s"], reviewResult: "ok",
      fromRoomId: R[code === "7440-001-0012/66" ? "213" : room], toRoomId: R[code === "7440-001-0012/66" ? "213" : room],
      idempotencyKey: `review:${round1.id}:${A[code].id}`, createdAt: at,
    });
  }
  // ผลทบทวนรอบนี้
  for (const [code, , , room, who, at] of list) {
    if (!at) continue;
    const t = d(at);
    await db.insert(reviews).values({ roundId: round2.id, assetId: A[code].id, reviewerId: U[who], result: "ok", createdAt: t, updatedAt: t });
    await db.insert(assetEvents).values({
      assetId: A[code].id, kind: "reviewed", actorId: U[who], reviewResult: "ok",
      fromRoomId: R[room], toRoomId: R[room], idempotencyKey: `review:${round2.id}:${A[code].id}`, createdAt: t,
    });
  }

  // ย้ายห้อง: โน้ตบุ๊ก 0012/66 จาก 213 มา 217 (3 ก.ย.)
  await db.insert(assetEvents).values({
    assetId: A["7440-001-0012/66"].id, kind: "room_moved", actorId: U["aree.s"],
    fromRoomId: R["213"], toRoomId: R["217"], fromUserId: U["aree.s"], toUserId: U["aree.s"],
    reason: "ย้ายมาใช้ประจำโต๊ะทำงานห้อง 217", idempotencyKey: "seed:move:1", createdAt: d("2026-09-03T10:20:00"),
  });

  // คำขอในอดีต + คำขอที่รอตอบ
  async function request(o: {
    asset: string; from: string; to: string; fromRoom: string; toRoom?: string;
    reason: string; status: "pending" | "accepted" | "rejected"; at: string; respondedAt?: string; responseReason?: string;
  }) {
    const [req] = await db.insert(transferRequests).values({
      assetId: A[o.asset].id, fromUserId: U[o.from], toUserId: U[o.to],
      fromRoomId: R[o.fromRoom], toRoomId: o.toRoom ? R[o.toRoom] : null,
      reason: o.reason, status: o.status, responseReason: o.responseReason ?? null,
      respondedAt: o.respondedAt ? d(o.respondedAt) : null, idempotencyKey: `seed:${o.asset}:${o.at}`, createdAt: d(o.at),
    }).returning();
    await db.insert(assetEvents).values({
      assetId: req.assetId, kind: "transfer_requested", actorId: U[o.from], requestId: req.id,
      fromRoomId: R[o.fromRoom], toRoomId: o.toRoom ? R[o.toRoom] : null, fromUserId: U[o.from], toUserId: U[o.to],
      reason: o.reason, createdAt: d(o.at),
    });
    if (o.status !== "pending") {
      await db.insert(assetEvents).values({
        assetId: req.assetId, kind: o.status === "accepted" ? "transfer_accepted" : "transfer_rejected",
        actorId: U[o.to], requestId: req.id, fromRoomId: R[o.fromRoom],
        toRoomId: o.toRoom ? R[o.toRoom] : R[o.fromRoom], fromUserId: U[o.from], toUserId: U[o.to],
        reason: o.status === "accepted" ? o.reason : o.responseReason, createdAt: d(o.respondedAt!),
      });
    }
  }
  await request({ asset: "7440-001-0013/66", from: "pimchanok.t", to: "aree.s", fromRoom: "213", toRoom: "217", reason: "เครื่องสำรองสำหรับงานบริการ", status: "accepted", at: "2026-06-14T09:00:00", respondedAt: "2026-06-15T10:00:00" });
  await request({ asset: "7440-005-0012/67", from: "pimchanok.t", to: "aree.s", fromRoom: "217", reason: "ย้ายงานดูแลจอภาพห้อง 217", status: "accepted", at: "2026-09-01T15:00:00", respondedAt: "2026-09-02T09:10:00" });
  await request({ asset: "7430-003-0021/63", from: "aree.s", to: "kanda.w", fromRoom: "217", toRoom: "305", reason: "ย้ายไปใช้ที่ห้องประชุม", status: "rejected", at: "2026-10-20T11:00:00", respondedAt: "2026-10-21T16:05:00", responseReason: "ห้องไม่มีที่วาง" });
  await request({ asset: "6730-004-0007/65", from: "napha.s", to: "aree.s", fromRoom: "304", toRoom: "217", reason: "ห้อง 304 ได้เครื่องใหม่แล้ว ขอให้ห้อง 217 ใช้แทนเครื่องที่ชำรุดค่ะ", status: "pending", at: "2026-10-30T14:12:00" });

  const counts = await db.execute(sql`select
    (select count(*) from users) as users, (select count(*) from assets) as assets,
    (select count(*) from asset_events) as events, (select count(*) from transfer_requests) as requests`);
  console.log("seed เสร็จ:", counts.rows[0]);
  console.log("ผู้ใช้ตัวอย่าง A = aree.s (คุณอารีย์), B = boonmee.k (คุณบุญมี) — สลับผู้ใช้ได้ที่หน้า /login ตอนรัน npm run dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
