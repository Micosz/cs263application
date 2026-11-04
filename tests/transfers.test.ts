import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { assetEvents, transferRequests } from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  acceptTransfer,
  cancelTransfer,
  createTransfer,
  moveRoom,
  rejectTransfer,
  saveReview,
} from "@/services/commands";
import {
  getAssetDetail,
  getAssetHistory,
  listMyAssets,
  listRequests,
  listVisibleAssets,
} from "@/services/queries";
import { assetRow, key, resetFixture, type Fixture } from "./fixtures";

let f: Fixture;
beforeEach(async () => {
  f = await resetFixture();
});
afterAll(closeDb);

const events = (assetId: string, kind?: string) =>
  getDb()
    .select()
    .from(assetEvents)
    .where(kind ? and(eq(assetEvents.assetId, assetId), eq(assetEvents.kind, kind as never)) : eq(assetEvents.assetId, assetId));

async function expectAppError(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  if (code) expect((err as AppError).code).toBe(code);
}

const myCodes = async (u: Fixture["A"]) => (await listMyAssets(u)).rows.map((r) => r.code).sort();

describe("กรณี 1: ย้ายห้อง ผู้รับผิดชอบยังเป็นคนเดิม", () => {
  it("เปลี่ยนห้อง คงผู้รับผิดชอบ และบันทึกผู้ทำรายการ ห้องเดิม ห้องใหม่ วันที่ เหตุผล", async () => {
    const k = key();
    const r = await moveRoom(f.A, { assetId: f.laptop.id, toRoomId: f.r102.id, reason: "ย้ายไปห้องประชุม", idempotencyKey: k });
    expect(r.duplicate).toBe(false);

    const a = await assetRow(f.laptop.id);
    expect(a.roomId).toBe(f.r102.id);
    expect(a.custodianId).toBe(f.A.id);

    const [ev] = await events(f.laptop.id, "room_moved");
    expect(ev).toMatchObject({
      actorId: f.A.id,
      fromRoomId: f.r101.id,
      toRoomId: f.r102.id,
      reason: "ย้ายไปห้องประชุม",
    });
    expect(ev.createdAt).toBeInstanceOf(Date);
    // "รีเฟรช" = อ่านใหม่จากฐานข้อมูลด้วย query เดียวกับหน้าเว็บ
    expect(await myCodes(f.A)).toEqual(["L-001", "L-002"]);
    const detail = await getAssetDetail(f.A, f.laptop.id);
    expect(detail.room.code).toBe("102");
    expect(detail.custodian.id).toBe(f.A.id);
  });

  it("กดยืนยันซ้ำ (รหัสรายการเดิม) ไม่สร้างประวัติซ้ำ", async () => {
    const k = key();
    const input = { assetId: f.laptop.id, toRoomId: f.r102.id, reason: "ย้าย", idempotencyKey: k };
    const [x, y] = await Promise.all([moveRoom(f.A, input), moveRoom(f.A, input)]);
    expect([x.duplicate, y.duplicate].sort()).toEqual([false, true]);
    const again = await moveRoom(f.A, input);
    expect(again.duplicate).toBe(true);
    expect(await events(f.laptop.id, "room_moved")).toHaveLength(1);
  });

  it("ตรวจสิทธิ์และข้อมูลที่ server", async () => {
    await expectAppError(moveRoom(f.B, { assetId: f.laptop.id, toRoomId: f.r102.id, reason: "x", idempotencyKey: key() }), 403);
    await expectAppError(moveRoom(f.A, { assetId: f.laptop.id, toRoomId: f.r101.id, reason: "x", idempotencyKey: key() }), 400);
    await expectAppError(moveRoom(f.A, { assetId: f.laptop.id, toRoomId: f.rM.id, reason: "x", idempotencyKey: key() }), 403);
    await expect(moveRoom(f.A, { assetId: f.laptop.id, toRoomId: f.r102.id, reason: "  ", idempotencyKey: key() })).rejects.toThrow(
      "กรุณาระบุเหตุผลก่อนดำเนินการต่อ",
    );
    expect(await events(f.laptop.id)).toHaveLength(0);
  });
});

describe("กรณี 2: B ยอมรับ ครุภัณฑ์ย้ายจากรายการของ A ไป B", () => {
  it("ระหว่างรอ A ยังเป็นผู้รับผิดชอบ เมื่อ B รับจึงเปลี่ยน", async () => {
    const { request } = await createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.B.id, reason: "ส่งต่องาน", idempotencyKey: key() });
    expect(request.status).toBe("pending");
    expect((await assetRow(f.laptop.id)).custodianId).toBe(f.A.id);
    expect(await myCodes(f.A)).toEqual(["L-001", "L-002"]);
    expect(await myCodes(f.B)).toEqual([]);
    expect((await listRequests(f.B)).incomingPending.map((r) => r.id)).toEqual([request.id]);

    const r = await acceptTransfer(f.B, request.id);
    expect(r.alreadyDone).toBe(false);
    expect(r.request.status).toBe("accepted");
    expect((await assetRow(f.laptop.id)).custodianId).toBe(f.B.id);
    expect(await myCodes(f.A)).toEqual(["L-002"]);
    expect(await myCodes(f.B)).toEqual(["L-001"]);

    const history = await getAssetHistory(f.laptop.id);
    expect(history.map((h) => h.kind)).toEqual(["transfer_accepted", "transfer_requested"]);
  });

  it("ส่งต่อพร้อมย้ายห้อง: ห้องเปลี่ยนเมื่อ B รับเท่านั้น", async () => {
    const { request } = await createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.B.id, toRoomId: f.r102.id, reason: "x", idempotencyKey: key() });
    expect((await assetRow(f.laptop.id)).roomId).toBe(f.r101.id);
    await acceptTransfer(f.B, request.id);
    const a = await assetRow(f.laptop.id);
    expect(a).toMatchObject({ custodianId: f.B.id, roomId: f.r102.id });
  });

  it("เฉพาะผู้รับที่ระบุตอบได้ และกดรับซ้ำไม่ทำให้ข้อมูลหรือประวัติซ้ำ", async () => {
    const { request } = await createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.B.id, reason: "x", idempotencyKey: key() });
    await expectAppError(acceptTransfer(f.A, request.id), 403);
    await expectAppError(acceptTransfer(f.C, request.id), 403);
    await expectAppError(rejectTransfer(f.C, request.id, { reason: "x" }), 403);

    const results = await Promise.all([acceptTransfer(f.B, request.id), acceptTransfer(f.B, request.id)]);
    expect(results.map((r) => r.alreadyDone).sort()).toEqual([false, true]);
    expect((await acceptTransfer(f.B, request.id)).alreadyDone).toBe(true);
    expect(await events(f.laptop.id, "transfer_accepted")).toHaveLength(1);
    await expectAppError(rejectTransfer(f.B, request.id, { reason: "x" }), 409, "already_answered");
  });

  it("ส่งคำขอซ้ำด้วยรหัสรายการเดิมได้คำขอเดียว และส่งซ้อนขณะยังรอไม่ได้", async () => {
    const input = { assetId: f.laptop.id, toUserId: f.B.id, reason: "x", idempotencyKey: key() };
    const [x, y] = await Promise.all([createTransfer(f.A, input), createTransfer(f.A, input)]);
    expect(x.request.id).toBe(y.request.id);
    const all = await getDb().select().from(transferRequests);
    expect(all).toHaveLength(1);
    await expectAppError(createTransfer(f.A, { ...input, idempotencyKey: key() }), 409, "pending_exists");
    await expectAppError(moveRoom(f.A, { assetId: f.laptop.id, toRoomId: f.r102.id, reason: "x", idempotencyKey: key() }), 409, "pending_exists");
  });

  it("เริ่มรายการได้เฉพาะผู้รับผิดชอบ และส่งได้เฉพาะคนในสาขา", async () => {
    await expectAppError(createTransfer(f.B, { assetId: f.laptop.id, toUserId: f.C.id, reason: "x", idempotencyKey: key() }), 403);
    await expectAppError(createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.M.id, reason: "x", idempotencyKey: key() }), 403);
    await expectAppError(createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.A.id, reason: "x", idempotencyKey: key() }), 400);
  });
});

describe("กรณี 3: B ปฏิเสธ ครุภัณฑ์ยังอยู่กับ A", () => {
  it("คงผู้รับผิดชอบเดิมและบันทึกผลในประวัติ", async () => {
    const { request } = await createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.B.id, toRoomId: f.r102.id, reason: "x", idempotencyKey: key() });
    const r = await rejectTransfer(f.B, request.id, { reason: "ห้องไม่มีที่วาง" });
    expect(r.request).toMatchObject({ status: "rejected", responseReason: "ห้องไม่มีที่วาง" });
    expect(await assetRow(f.laptop.id)).toMatchObject({ custodianId: f.A.id, roomId: f.r101.id });
    expect(await myCodes(f.A)).toEqual(["L-001", "L-002"]);
    expect(await myCodes(f.B)).toEqual([]);
    const [ev] = await events(f.laptop.id, "transfer_rejected");
    expect(ev).toMatchObject({ actorId: f.B.id, reason: "ห้องไม่มีที่วาง", requestId: request.id });

    expect((await rejectTransfer(f.B, request.id, { reason: "อีกครั้ง" })).alreadyDone).toBe(true);
    expect(await events(f.laptop.id, "transfer_rejected")).toHaveLength(1);
    await expectAppError(acceptTransfer(f.B, request.id), 409, "already_answered");
    // หลังปฏิเสธ A ส่งต่อใหม่ได้
    await createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.C.id, reason: "ลองคนอื่น", idempotencyKey: key() });
  });

  it("ผู้ส่งยกเลิกคำขอได้ ผู้รับตอบหลังยกเลิกไม่ได้", async () => {
    const { request } = await createTransfer(f.A, { assetId: f.laptop.id, toUserId: f.B.id, reason: "x", idempotencyKey: key() });
    await expectAppError(cancelTransfer(f.B, request.id), 403);
    await cancelTransfer(f.A, request.id);
    await expectAppError(acceptTransfer(f.B, request.id), 409);
    expect((await assetRow(f.laptop.id)).custodianId).toBe(f.A.id);
  });
});

describe("สิทธิ์ดูข้อมูลและการทบทวน", () => {
  it("ครุภัณฑ์ทั้งหมดแสดงเฉพาะที่มีสิทธิ์ดู", async () => {
    const list = await listVisibleAssets(f.A);
    expect(list.rows.map((r) => r.code).sort()).toEqual(["L-001", "L-002"]);
    await expectAppError(getAssetDetail(f.A, f.mathAsset.id), 403);
    const mList = await listVisibleAssets(f.M);
    expect(mList.rows.map((r) => r.code)).toEqual(["M-001"]);
  });

  it("บันทึกผลทบทวนซ้ำในรอบเดียวกันเป็นการแก้ผล ไม่สร้างแถวซ้ำ", async () => {
    await saveReview(f.A, { assetId: f.laptop.id, result: "ok" });
    await saveReview(f.A, { assetId: f.laptop.id, result: "broken", note: "จอไม่ติด" });
    const ev = await events(f.laptop.id, "reviewed");
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ reviewResult: "broken", reason: "จอไม่ติด" });
    await expectAppError(saveReview(f.B, { assetId: f.laptop.id, result: "ok" }), 403);
  });
});
