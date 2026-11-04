import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DbOrTx } from "@/db";
import {
  assetEvents,
  assets,
  reviews,
  rooms,
  transferRequests,
  users,
  REVIEW_RESULTS,
  type User,
} from "@/db/schema";
import { Errors, isUniqueViolation } from "@/lib/errors";
import { getActiveRound } from "./queries";

const reason = z
  .string({ error: "กรุณาระบุเหตุผลก่อนดำเนินการต่อ" })
  .trim()
  .min(1, "กรุณาระบุเหตุผลก่อนดำเนินการต่อ")
  .max(500, "เหตุผลยาวได้ไม่เกิน 500 ตัวอักษร");
const idemKey = z
  .string({ error: "ไม่มีรหัสรายการ ลองเปิดหน้านี้ใหม่" })
  .min(8)
  .max(100);

export const moveRoomInput = z.object({
  assetId: z.uuid("ไม่พบครุภัณฑ์นี้"),
  toRoomId: z.number({ error: "กรุณาเลือกห้อง" }).int().positive(),
  reason,
  idempotencyKey: idemKey,
});

export const transferInput = z.object({
  assetId: z.uuid("ไม่พบครุภัณฑ์นี้"),
  toUserId: z.uuid("กรุณาเลือกผู้ดูแลคนใหม่"),
  toRoomId: z.number().int().positive().nullable().optional(),
  reason,
  idempotencyKey: idemKey,
});

export const rejectInput = z.object({ reason });

export const reviewInput = z.object({
  assetId: z.uuid("ไม่พบครุภัณฑ์นี้"),
  result: z.enum(REVIEW_RESULTS, { error: "เลือกผลก่อนบันทึก" }),
  note: z.string().trim().max(500).optional().nullable(),
});

async function lockAsset(tx: DbOrTx, assetId: string) {
  const [a] = await tx.select().from(assets).where(eq(assets.id, assetId)).for("update");
  if (!a) throw Errors.notFound("ไม่พบครุภัณฑ์นี้");
  return a;
}

async function findPending(tx: DbOrTx, assetId: string) {
  const [p] = await tx
    .select()
    .from(transferRequests)
    .where(and(eq(transferRequests.assetId, assetId), eq(transferRequests.status, "pending")))
    .limit(1);
  return p;
}

async function roomInDepartment(tx: DbOrTx, user: User, roomId: number) {
  const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) throw Errors.notFound("ไม่พบห้องนี้");
  if (user.role !== "admin" && room.departmentId !== user.departmentId) {
    throw Errors.forbidden("เลือกได้เฉพาะห้องในสาขาของคุณ");
  }
  return room;
}

const notCustodian = () =>
  Errors.forbidden("เฉพาะผู้รับผิดชอบครุภัณฑ์ชิ้นนี้เท่านั้นที่ทำรายการได้");
const pendingExists = () =>
  Errors.conflict(
    "pending_exists",
    "มีคำขอส่งต่อที่รอตอบรับอยู่ ยกเลิกคำขอเดิมก่อนจึงทำรายการใหม่ได้",
  );

/**
 * ย้ายห้อง: ผู้รับผิดชอบยืนยันแล้วมีผลทันที ผู้รับผิดชอบคงเดิม
 * บันทึกผู้ทำรายการ ห้องเดิม ห้องใหม่ วันที่ และเหตุผล
 */
export async function moveRoom(user: User, raw: unknown) {
  const input = moveRoomInput.parse(raw);
  const key = `move:${user.id}:${input.idempotencyKey}`;
  return getDb().transaction(async (tx) => {
    const asset = await lockAsset(tx, input.assetId);
    // กดยืนยันซ้ำ / ส่งซ้ำ → คืนผลเดิม ไม่สร้างประวัติซ้ำ (ตรวจหลังล็อกแถว จึงกันกรณีส่งพร้อมกันด้วย)
    const [dup] = await tx.select().from(assetEvents).where(eq(assetEvents.idempotencyKey, key));
    if (dup) return { duplicate: true, assetId: asset.id, roomId: dup.toRoomId };

    if (asset.custodianId !== user.id) throw notCustodian();
    const room = await roomInDepartment(tx, user, input.toRoomId);
    if (room.id === asset.roomId) throw Errors.invalid("ครุภัณฑ์อยู่ห้องนี้อยู่แล้ว");
    if (await findPending(tx, asset.id)) throw pendingExists();

    await tx.insert(assetEvents).values({
      assetId: asset.id,
      kind: "room_moved",
      actorId: user.id,
      fromRoomId: asset.roomId,
      toRoomId: room.id,
      fromUserId: asset.custodianId,
      toUserId: asset.custodianId,
      reason: input.reason,
      idempotencyKey: key,
    });
    await tx
      .update(assets)
      .set({ roomId: room.id, updatedAt: new Date() })
      .where(eq(assets.id, asset.id));
    return { duplicate: false, assetId: asset.id, roomId: room.id };
  });
}

/**
 * ส่งต่อ (และย้ายห้องพร้อมกันถ้าเลือก): สร้างคำขอ "รอตอบรับ"
 * ผู้รับผิดชอบเดิมยังดูแลจนกว่าผู้รับจะตอบรับ
 */
export async function createTransfer(user: User, raw: unknown) {
  const input = transferInput.parse(raw);
  const key = `transfer:${user.id}:${input.idempotencyKey}`;
  try {
    return await getDb().transaction(async (tx) => {
      const asset = await lockAsset(tx, input.assetId);
      const [dup] = await tx
        .select()
        .from(transferRequests)
        .where(eq(transferRequests.idempotencyKey, key));
      if (dup) return { duplicate: true, request: dup };

      if (asset.custodianId !== user.id) throw notCustodian();
      if (input.toUserId === user.id) throw Errors.invalid("เลือกผู้ดูแลคนใหม่ที่ไม่ใช่ตัวคุณเอง");
      const [toUser] = await tx.select().from(users).where(eq(users.id, input.toUserId));
      if (!toUser || !toUser.active) throw Errors.notFound("ไม่พบผู้รับคนนี้ในระบบ");
      if (user.role !== "admin" && toUser.departmentId !== user.departmentId) {
        throw Errors.forbidden("ส่งต่อได้เฉพาะบุคลากรในสาขาเดียวกัน");
      }
      let toRoomId: number | null = null;
      if (input.toRoomId) {
        const room = await roomInDepartment(tx, user, input.toRoomId);
        if (room.id === asset.roomId) throw Errors.invalid("ครุภัณฑ์อยู่ห้องนี้อยู่แล้ว");
        toRoomId = room.id;
      }
      if (await findPending(tx, asset.id)) throw pendingExists();

      const [request] = await tx
        .insert(transferRequests)
        .values({
          assetId: asset.id,
          fromUserId: user.id,
          toUserId: toUser.id,
          fromRoomId: asset.roomId,
          toRoomId,
          reason: input.reason,
          idempotencyKey: key,
        })
        .returning();
      await tx.insert(assetEvents).values({
        assetId: asset.id,
        kind: "transfer_requested",
        actorId: user.id,
        fromRoomId: asset.roomId,
        toRoomId,
        fromUserId: user.id,
        toUserId: toUser.id,
        reason: input.reason,
        requestId: request.id,
      });
      return { duplicate: false, request };
    });
  } catch (e) {
    if (isUniqueViolation(e, "transfer_one_pending_per_asset")) throw pendingExists();
    throw e;
  }
}

async function lockRequest(tx: DbOrTx, requestId: string) {
  if (!z.uuid().safeParse(requestId).success) throw Errors.notFound("ไม่พบคำขอนี้");
  const [req] = await tx
    .select()
    .from(transferRequests)
    .where(eq(transferRequests.id, requestId))
    .for("update");
  if (!req) throw Errors.notFound("ไม่พบคำขอนี้");
  return req;
}

const answered = () =>
  Errors.conflict(
    "already_answered",
    "คำขอนี้ไม่อยู่ในสถานะรอตอบรับแล้ว จึงตอบซ้ำไม่ได้",
  );
const notRecipient = () =>
  Errors.forbidden("คำขอนี้ไม่ได้ส่งถึงคุณ เฉพาะผู้รับที่ระบุเท่านั้นที่ตอบได้");

/** ผู้รับตอบรับ → เปลี่ยนผู้รับผิดชอบ (และห้องถ้ามีในคำขอ) */
export async function acceptTransfer(user: User, requestId: string) {
  return getDb().transaction(async (tx) => {
    const req = await lockRequest(tx, requestId);
    if (req.toUserId !== user.id) throw notRecipient();
    if (req.status === "accepted") return { alreadyDone: true, request: req };
    if (req.status !== "pending") throw answered();

    const asset = await lockAsset(tx, req.assetId);
    if (asset.custodianId !== req.fromUserId) {
      throw Errors.conflict(
        "asset_changed",
        "ผู้รับผิดชอบครุภัณฑ์เปลี่ยนไปแล้ว คำขอนี้จึงใช้ไม่ได้",
      );
    }
    const newRoomId = req.toRoomId ?? asset.roomId;
    const now = new Date();
    await tx
      .update(assets)
      .set({ custodianId: user.id, roomId: newRoomId, updatedAt: now })
      .where(eq(assets.id, asset.id));
    const [updated] = await tx
      .update(transferRequests)
      .set({ status: "accepted", respondedAt: now })
      .where(and(eq(transferRequests.id, req.id), eq(transferRequests.status, "pending")))
      .returning();
    await tx.insert(assetEvents).values({
      assetId: asset.id,
      kind: "transfer_accepted",
      actorId: user.id,
      fromRoomId: asset.roomId,
      toRoomId: newRoomId,
      fromUserId: req.fromUserId,
      toUserId: user.id,
      reason: req.reason,
      requestId: req.id,
    });
    return { alreadyDone: false, request: updated };
  });
}

/** ผู้รับปฏิเสธ → ผู้รับผิดชอบและห้องคงเดิม บันทึกผลในประวัติ */
export async function rejectTransfer(user: User, requestId: string, raw: unknown) {
  const input = rejectInput.parse(raw);
  return getDb().transaction(async (tx) => {
    const req = await lockRequest(tx, requestId);
    if (req.toUserId !== user.id) throw notRecipient();
    if (req.status === "rejected") return { alreadyDone: true, request: req };
    if (req.status !== "pending") throw answered();

    const [updated] = await tx
      .update(transferRequests)
      .set({ status: "rejected", responseReason: input.reason, respondedAt: new Date() })
      .where(eq(transferRequests.id, req.id))
      .returning();
    await tx.insert(assetEvents).values({
      assetId: req.assetId,
      kind: "transfer_rejected",
      actorId: user.id,
      fromRoomId: req.fromRoomId,
      toRoomId: req.toRoomId,
      fromUserId: req.fromUserId,
      toUserId: user.id,
      reason: input.reason,
      requestId: req.id,
    });
    return { alreadyDone: false, request: updated };
  });
}

/** ผู้ส่งยกเลิกคำขอที่ยังไม่มีคนตอบ */
export async function cancelTransfer(user: User, requestId: string) {
  return getDb().transaction(async (tx) => {
    const req = await lockRequest(tx, requestId);
    if (req.fromUserId !== user.id) throw Errors.forbidden("เฉพาะผู้ส่งคำขอเท่านั้นที่ยกเลิกได้");
    if (req.status === "cancelled") return { alreadyDone: true, request: req };
    if (req.status !== "pending") throw answered();
    const [updated] = await tx
      .update(transferRequests)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(eq(transferRequests.id, req.id))
      .returning();
    await tx.insert(assetEvents).values({
      assetId: req.assetId,
      kind: "transfer_cancelled",
      actorId: user.id,
      fromRoomId: req.fromRoomId,
      toRoomId: req.toRoomId,
      fromUserId: req.fromUserId,
      toUserId: req.toUserId,
      requestId: req.id,
    });
    return { alreadyDone: false, request: updated };
  });
}

/** บันทึกผลทบทวนในรอบที่เปิดอยู่ (แก้ผลในรอบเดียวกันได้ ไม่สร้างแถวซ้ำ) */
export async function saveReview(user: User, raw: unknown) {
  const input = reviewInput.parse(raw);
  const round = await getActiveRound();
  if (!round) throw Errors.conflict("no_round", "ตอนนี้ไม่อยู่ในรอบทบทวน");
  return getDb().transaction(async (tx) => {
    const asset = await lockAsset(tx, input.assetId);
    if (asset.custodianId !== user.id) throw notCustodian();
    const now = new Date();
    const note = input.result === "broken" ? input.note || null : null;
    await tx
      .insert(reviews)
      .values({
        roundId: round.id,
        assetId: asset.id,
        reviewerId: user.id,
        result: input.result,
        note,
      })
      .onConflictDoUpdate({
        target: [reviews.roundId, reviews.assetId],
        set: { result: input.result, note, reviewerId: user.id, updatedAt: now },
      });
    await tx
      .insert(assetEvents)
      .values({
        assetId: asset.id,
        kind: "reviewed",
        actorId: user.id,
        fromRoomId: asset.roomId,
        toRoomId: asset.roomId,
        reviewResult: input.result,
        reason: note,
        idempotencyKey: `review:${round.id}:${asset.id}`,
      })
      .onConflictDoUpdate({
        target: assetEvents.idempotencyKey,
        set: { reviewResult: input.result, reason: note, actorId: user.id, createdAt: now },
      });
    return { roundId: round.id, assetId: asset.id, result: input.result };
  });
}
