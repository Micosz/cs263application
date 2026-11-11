import { and, asc, count, countDistinct, desc, eq, gt, ilike, inArray, isNull, lte, gte, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import {
  assetEvents,
  assetTypes,
  assets,
  notifications,
  reviewRounds,
  reviews,
  rooms,
  transferRequests,
  users,
  type User,
} from "@/db/schema";
import { Errors } from "@/lib/errors";
import { canViewAsset, canViewRequest } from "./permissions";

const custodian = alias(users, "custodian");
const fromUser = alias(users, "from_user");
const toUser = alias(users, "to_user");
const actor = alias(users, "actor");
const fromRoom = alias(rooms, "from_room");
const toRoom = alias(rooms, "to_room");

export type Person = {
  id: string;
  fullName: string;
  avatarBg: string;
  avatarFg: string;
};

const custodianPerson = { id: custodian.id, fullName: custodian.fullName, avatarBg: custodian.avatarBg, avatarFg: custodian.avatarFg };
const fromUserPerson = { id: fromUser.id, fullName: fromUser.fullName, avatarBg: fromUser.avatarBg, avatarFg: fromUser.avatarFg };
const toUserPerson = { id: toUser.id, fullName: toUser.fullName, avatarBg: toUser.avatarBg, avatarFg: toUser.avatarFg };
const actorPerson = { id: actor.id, fullName: actor.fullName, avatarBg: actor.avatarBg, avatarFg: actor.avatarFg };
const usersPerson = { id: users.id, fullName: users.fullName, avatarBg: users.avatarBg, avatarFg: users.avatarFg };

/* ---------------------------- รอบทบทวน ---------------------------- */

export async function getActiveRound(now = new Date()) {
  const [r] = await getDb()
    .select()
    .from(reviewRounds)
    .where(and(lte(reviewRounds.startsAt, now), gte(reviewRounds.endsAt, now)))
    .orderBy(desc(reviewRounds.startsAt))
    .limit(1);
  return r ?? null;
}

export async function getNextRound(now = new Date()) {
  const [r] = await getDb()
    .select()
    .from(reviewRounds)
    .where(gt(reviewRounds.startsAt, now))
    .orderBy(asc(reviewRounds.startsAt))
    .limit(1);
  return r ?? null;
}

/* ---------------------------- รายการครุภัณฑ์ ---------------------------- */

function visibleTo(user: User): SQL | undefined {
  if (user.role === "admin") return undefined;
  return or(eq(rooms.departmentId, user.departmentId), eq(assets.custodianId, user.id));
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export type AssetFilters = {
  q?: string;
  type?: string;
  roomId?: number;
  todoOnly?: boolean;
  limit?: number;
};

/** หน้า "ครุภัณฑ์ทั้งหมด": เฉพาะรายการที่ผู้ใช้มีสิทธิ์ดู */
export async function listVisibleAssets(user: User, f: AssetFilters = {}) {
  const db = getDb();
  const round = await getActiveRound();
  const roundId = round?.id ?? -1;
  const conds: (SQL | undefined)[] = [visibleTo(user)];
  const q = f.q?.trim();
  if (q) {
    const p = `%${escapeLike(q)}%`;
    conds.push(or(ilike(assets.code, p), ilike(assets.name, p), ilike(rooms.code, p), ilike(rooms.name, p)));
  }
  if (f.type) conds.push(eq(assets.typeKey, f.type));
  if (f.roomId) conds.push(eq(assets.roomId, f.roomId));
  if (f.todoOnly) conds.push(isNull(reviews.id));
  const where = and(...conds);
  const limit = Math.min(Math.max(f.limit ?? 60, 1), 500);

  const base = db
    .select({
      id: assets.id,
      code: assets.code,
      name: assets.name,
      type: assets.typeKey,
      roomCode: rooms.code,
      custodian: custodianPerson,
      reviewedAt: reviews.updatedAt,
    })
    .from(assets)
    .innerJoin(rooms, eq(rooms.id, assets.roomId))
    .innerJoin(custodian, eq(custodian.id, assets.custodianId))
    .leftJoin(reviews, and(eq(reviews.assetId, assets.id), eq(reviews.roundId, roundId)));

  const [rows, [totals]] = await Promise.all([
    base.where(where).orderBy(asc(rooms.code), asc(assets.code)).limit(limit + 1),
    db
      .select({ total: count(assets.id), roomCount: countDistinct(assets.roomId) })
      .from(assets)
      .innerJoin(rooms, eq(rooms.id, assets.roomId))
      .leftJoin(reviews, and(eq(reviews.assetId, assets.id), eq(reviews.roundId, roundId)))
      .where(where),
  ]);
  return {
    rows: rows.slice(0, limit),
    hasMore: rows.length > limit,
    total: totals?.total ?? 0,
    roomCount: totals?.roomCount ?? 0,
    round,
  };
}

export async function listAssetTypes() {
  return getDb().select().from(assetTypes).orderBy(asc(assetTypes.sort));
}

/** ห้องที่ผู้ใช้เลือกได้ (ห้องในสาขาตัวเอง) พร้อมจำนวนครุภัณฑ์ */
export async function listRoomsForUser(user: User) {
  const db = getDb();
  const rows = await db
    .select({ id: rooms.id, code: rooms.code, name: rooms.name, n: count(assets.id) })
    .from(rooms)
    .leftJoin(assets, eq(assets.roomId, rooms.id))
    .where(user.role === "admin" ? undefined : eq(rooms.departmentId, user.departmentId))
    .groupBy(rooms.id)
    .orderBy(asc(rooms.code));
  return rows;
}

/** หน้า "ครุภัณฑ์ของฉัน": เฉพาะชิ้นที่ผู้ใช้ปัจจุบันรับผิดชอบ */
export async function listMyAssets(user: User) {
  const round = await getActiveRound();
  const rows = await getDb()
    .select({
      id: assets.id,
      code: assets.code,
      name: assets.name,
      type: assets.typeKey,
      roomId: rooms.id,
      roomCode: rooms.code,
      roomName: rooms.name,
      reviewedAt: reviews.updatedAt,
      reviewResult: reviews.result,
      reviewNote: reviews.note,
    })
    .from(assets)
    .innerJoin(rooms, eq(rooms.id, assets.roomId))
    .leftJoin(reviews, and(eq(reviews.assetId, assets.id), eq(reviews.roundId, round?.id ?? -1)))
    .where(eq(assets.custodianId, user.id))
    .orderBy(asc(rooms.code), asc(assets.code));
  return { rows, round };
}

export type MyAssetRow = Awaited<ReturnType<typeof listMyAssets>>["rows"][number];

/** คำขอส่งต่อที่ผู้ใช้ส่งออกไปและยังรอตอบ แยกตามครุภัณฑ์ */
export async function pendingOutgoingByAsset(userId: string) {
  const rows = await getDb()
    .select({ assetId: transferRequests.assetId, toName: toUser.fullName })
    .from(transferRequests)
    .innerJoin(toUser, eq(toUser.id, transferRequests.toUserId))
    .where(and(eq(transferRequests.fromUserId, userId), eq(transferRequests.status, "pending")));
  return new Map(rows.map((r) => [r.assetId, r.toName]));
}

/** จัดกลุ่มตามห้อง ห้องที่มีรายการมากก่อน */
export function groupByRoom<T extends { roomId: number; roomCode: string; roomName: string }>(rows: T[]) {
  const map = new Map<number, { roomId: number; code: string; name: string; items: T[] }>();
  for (const r of rows) {
    const g = map.get(r.roomId) ?? { roomId: r.roomId, code: r.roomCode, name: r.roomName, items: [] };
    g.items.push(r);
    map.set(r.roomId, g);
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length || a.code.localeCompare(b.code));
}

/* ---------------------------- รายละเอียดครุภัณฑ์ ---------------------------- */

export async function getAssetDetail(user: User, assetId: string) {
  const db = getDb();
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) throw Errors.notFound("ไม่พบครุภัณฑ์นี้");
  const [a] = await db
    .select({
      asset: assets,
      typeLabel: assetTypes.label,
      room: rooms,
      custodian: custodianPerson,
      custodianLine: custodian.lineUserId,
    })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.key, assets.typeKey))
    .innerJoin(rooms, eq(rooms.id, assets.roomId))
    .innerJoin(custodian, eq(custodian.id, assets.custodianId))
    .where(eq(assets.id, assetId));
  if (!a) throw Errors.notFound("ไม่พบครุภัณฑ์นี้");
  if (!canViewAsset(user, { custodianId: a.asset.custodianId, roomDepartmentId: a.room.departmentId })) {
    throw Errors.forbidden();
  }

  const round = await getActiveRound();
  const [pending, [lastReview], roundReview, history] = await Promise.all([
    db
      .select({
        id: transferRequests.id,
        seq: transferRequests.seq,
        createdAt: transferRequests.createdAt,
        fromUserId: transferRequests.fromUserId,
        toUser: toUserPerson,
        toRoomCode: toRoom.code,
      })
      .from(transferRequests)
      .innerJoin(toUser, eq(toUser.id, transferRequests.toUserId))
      .leftJoin(toRoom, eq(toRoom.id, transferRequests.toRoomId))
      .where(and(eq(transferRequests.assetId, assetId), eq(transferRequests.status, "pending")))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({ result: reviews.result, at: reviews.updatedAt })
      .from(reviews)
      .where(eq(reviews.assetId, assetId))
      .orderBy(desc(reviews.updatedAt))
      .limit(1),
    round
      ? db
          .select({ result: reviews.result, at: reviews.updatedAt })
          .from(reviews)
          .where(and(eq(reviews.assetId, assetId), eq(reviews.roundId, round.id)))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    getAssetHistory(assetId),
  ]);

  return {
    ...a,
    canManage: a.asset.custodianId === user.id,
    pending,
    lastReview: lastReview ?? null,
    roundReview,
    round,
    history,
  };
}

export async function getAssetHistory(assetId: string, limit = 100) {
  return getDb()
    .select({
      id: assetEvents.id,
      kind: assetEvents.kind,
      createdAt: assetEvents.createdAt,
      reason: assetEvents.reason,
      reviewResult: assetEvents.reviewResult,
      requestId: assetEvents.requestId,
      actor: actorPerson,
      fromRoom: fromRoom.code,
      toRoom: toRoom.code,
      fromUser: { id: fromUser.id, fullName: fromUser.fullName },
      toUser: { id: toUser.id, fullName: toUser.fullName },
    })
    .from(assetEvents)
    .innerJoin(actor, eq(actor.id, assetEvents.actorId))
    .leftJoin(fromRoom, eq(fromRoom.id, assetEvents.fromRoomId))
    .leftJoin(toRoom, eq(toRoom.id, assetEvents.toRoomId))
    .leftJoin(fromUser, eq(fromUser.id, assetEvents.fromUserId))
    .leftJoin(toUser, eq(toUser.id, assetEvents.toUserId))
    .where(eq(assetEvents.assetId, assetId))
    .orderBy(desc(assetEvents.createdAt), desc(assetEvents.id))
    .limit(limit);
}

export type HistoryRow = Awaited<ReturnType<typeof getAssetHistory>>[number];

export const MY_HISTORY_KINDS = {
  review: ["reviewed"],
  transfer: ["transfer_requested", "transfer_accepted", "transfer_rejected", "transfer_cancelled"],
  move: ["room_moved"],
} as const;
export type MyHistoryFilter = keyof typeof MY_HISTORY_KINDS;

/** หน้า "ประวัติของฉัน": ทุกรายการที่ผู้ใช้เป็นผู้ทำ ใหม่สุดก่อน */
export async function listMyHistory(userId: string, filter?: MyHistoryFilter, limit = 200) {
  return getDb()
    .select({
      id: assetEvents.id,
      kind: assetEvents.kind,
      createdAt: assetEvents.createdAt,
      reason: assetEvents.reason,
      reviewResult: assetEvents.reviewResult,
      requestId: assetEvents.requestId,
      actor: actorPerson,
      fromRoom: fromRoom.code,
      toRoom: toRoom.code,
      fromUser: { id: fromUser.id, fullName: fromUser.fullName },
      toUser: { id: toUser.id, fullName: toUser.fullName },
      asset: { id: assets.id, code: assets.code, name: assets.name, type: assets.typeKey },
    })
    .from(assetEvents)
    .innerJoin(actor, eq(actor.id, assetEvents.actorId))
    .innerJoin(assets, eq(assets.id, assetEvents.assetId))
    .leftJoin(fromRoom, eq(fromRoom.id, assetEvents.fromRoomId))
    .leftJoin(toRoom, eq(toRoom.id, assetEvents.toRoomId))
    .leftJoin(fromUser, eq(fromUser.id, assetEvents.fromUserId))
    .leftJoin(toUser, eq(toUser.id, assetEvents.toUserId))
    .where(
      and(
        eq(assetEvents.actorId, userId),
        filter ? inArray(assetEvents.kind, [...MY_HISTORY_KINDS[filter]]) : undefined,
      ),
    )
    .orderBy(desc(assetEvents.createdAt), desc(assetEvents.id))
    .limit(limit);
}

/* ---------------------------- คนและคำขอ ---------------------------- */

/** บุคลากรในสาขาเดียวกันที่ส่งต่อให้ได้ */
export async function listColleagues(user: User) {
  return getDb()
    .select({
      ...usersPerson,
      position: users.position,
      hasLine: sql<boolean>`${users.lineUserId} is not null`,
    })
    .from(users)
    .where(and(eq(users.departmentId, user.departmentId), eq(users.active, true), ne(users.id, user.id)))
    .orderBy(asc(users.fullName));
}

function requestSelect() {
  return getDb()
    .select({
      id: transferRequests.id,
      seq: transferRequests.seq,
      status: transferRequests.status,
      reason: transferRequests.reason,
      responseReason: transferRequests.responseReason,
      createdAt: transferRequests.createdAt,
      respondedAt: transferRequests.respondedAt,
      fromUserId: transferRequests.fromUserId,
      toUserId: transferRequests.toUserId,
      from: fromUserPerson,
      to: { ...toUserPerson, hasLine: sql<boolean>`${toUser.lineUserId} is not null` },
      fromRoomCode: fromRoom.code,
      toRoomCode: toRoom.code,
      asset: {
        id: assets.id,
        code: assets.code,
        name: assets.name,
        type: assets.typeKey,
        custodianId: assets.custodianId,
      },
      currentRoomCode: rooms.code,
    })
    .from(transferRequests)
    .innerJoin(fromUser, eq(fromUser.id, transferRequests.fromUserId))
    .innerJoin(toUser, eq(toUser.id, transferRequests.toUserId))
    .innerJoin(fromRoom, eq(fromRoom.id, transferRequests.fromRoomId))
    .leftJoin(toRoom, eq(toRoom.id, transferRequests.toRoomId))
    .innerJoin(assets, eq(assets.id, transferRequests.assetId))
    .innerJoin(rooms, eq(rooms.id, assets.roomId))
    .$dynamic();
}

export type RequestRow = Awaited<ReturnType<ReturnType<typeof requestSelect>["execute"]>>[number];

export async function listRequests(user: User) {
  const [incomingPending, incomingDone, outgoingPending, outgoingDone] = await Promise.all([
    requestSelect()
      .where(and(eq(transferRequests.toUserId, user.id), eq(transferRequests.status, "pending")))
      .orderBy(desc(transferRequests.createdAt)),
    requestSelect()
      .where(and(eq(transferRequests.toUserId, user.id), ne(transferRequests.status, "pending")))
      .orderBy(desc(transferRequests.respondedAt))
      .limit(20),
    requestSelect()
      .where(and(eq(transferRequests.fromUserId, user.id), eq(transferRequests.status, "pending")))
      .orderBy(desc(transferRequests.createdAt)),
    requestSelect()
      .where(and(eq(transferRequests.fromUserId, user.id), ne(transferRequests.status, "pending")))
      .orderBy(desc(transferRequests.respondedAt))
      .limit(20),
  ]);
  const notes = await latestNotifications(outgoingPending.map((r) => r.id), "transfer_requested");
  return {
    incomingPending,
    incomingDone,
    outgoingPending: outgoingPending.map((r) => ({ ...r, notification: notes.get(r.id) ?? null })),
    outgoingDone,
  };
}

async function latestNotifications(requestIds: string[], kind: "transfer_requested") {
  const map = new Map<string, { status: string; error: string | null }>();
  if (!requestIds.length) return map;
  const rows = await getDb()
    .select({ requestId: notifications.requestId, status: notifications.status, error: notifications.error })
    .from(notifications)
    .where(and(inArray(notifications.requestId, requestIds), eq(notifications.kind, kind)));
  for (const r of rows) if (r.requestId) map.set(r.requestId, { status: r.status, error: r.error });
  return map;
}

export async function getRequestDetail(user: User, requestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw Errors.notFound("ไม่พบคำขอนี้");
  const [r] = await requestSelect().where(eq(transferRequests.id, requestId));
  if (!r) throw Errors.notFound("ไม่พบคำขอนี้");
  if (!canViewRequest(user, r)) {
    throw Errors.forbidden("คำขอนี้ไม่ได้ส่งถึงคุณ เฉพาะผู้รับที่ระบุเท่านั้นที่ตอบได้");
  }
  const notes = await latestNotifications([r.id], "transfer_requested");
  return { ...r, notification: notes.get(r.id) ?? null };
}

export async function countIncomingPending(userId: string) {
  const [r] = await getDb()
    .select({ n: count() })
    .from(transferRequests)
    .where(and(eq(transferRequests.toUserId, userId), eq(transferRequests.status, "pending")));
  return r?.n ?? 0;
}

/* ---------------------------- หน้าหลัก ---------------------------- */

export async function getHomeSummary(user: User) {
  const [{ rows, round }, requests] = await Promise.all([
    listMyAssets(user),
    requestSelect()
      .where(and(eq(transferRequests.toUserId, user.id), eq(transferRequests.status, "pending")))
      .orderBy(desc(transferRequests.createdAt)),
  ]);
  const todo = rows.filter((r) => !r.reviewedAt);
  return {
    round,
    total: rows.length,
    reviewed: rows.length - todo.length,
    todo,
    rooms: groupByRoom(rows).map((g) => ({ roomId: g.roomId, code: g.code, n: g.items.length })),
    requests,
  };
}
