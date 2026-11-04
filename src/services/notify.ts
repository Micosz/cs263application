import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import {
  assets,
  notifications,
  rooms,
  transferRequests,
  users,
  type NotificationKind,
  type User,
} from "@/db/schema";
import { Errors } from "@/lib/errors";
import { appBaseUrl, appLink, isMessagingConfigured } from "@/lib/line/config";
import {
  transferAcceptedMessage,
  transferRejectedMessage,
  transferRequestedMessage,
  type TransferMessageData,
} from "@/lib/line/flex";
import { pushMessage } from "@/lib/line/messaging";

const fromUser = alias(users, "n_from_user");
const toUser = alias(users, "n_to_user");
const fromRoom = alias(rooms, "n_from_room");
const toRoom = alias(rooms, "n_to_room");

async function loadRequest(requestId: string) {
  const [r] = await getDb()
    .select({
      req: transferRequests,
      asset: { id: assets.id, name: assets.name, code: assets.code, type: assets.typeKey },
      from: fromUser,
      to: toUser,
      fromRoomCode: fromRoom.code,
      toRoomCode: toRoom.code,
    })
    .from(transferRequests)
    .innerJoin(assets, eq(assets.id, transferRequests.assetId))
    .innerJoin(fromUser, eq(fromUser.id, transferRequests.fromUserId))
    .innerJoin(toUser, eq(toUser.id, transferRequests.toUserId))
    .innerJoin(fromRoom, eq(fromRoom.id, transferRequests.fromRoomId))
    .leftJoin(toRoom, eq(toRoom.id, transferRequests.toRoomId))
    .where(eq(transferRequests.id, requestId));
  return r;
}

export type NotifyOutcome = {
  id: string;
  status: "pending" | "sent" | "failed" | "skipped";
  error: string | null;
};

/**
 * ส่งข้อความ LINE ของคำขอ แล้วบันทึกผลตามจริงในตาราง notifications
 * - ส่งไม่สำเร็จ/ยังไม่ตั้งค่า: คำขอยังอยู่ ผู้รับเปิดจากเว็บได้ และเก็บเหตุผลไว้
 * - เรียกซ้ำ: ถ้าส่งสำเร็จแล้วจะไม่ส่งซ้ำ (และใช้ X-Line-Retry-Key เดิมกัน LINE ส่งซ้ำ)
 */
export async function sendTransferNotification(
  requestId: string,
  kind: NotificationKind,
  fallbackOrigin?: string,
): Promise<NotifyOutcome> {
  const db = getDb();
  const r = await loadRequest(requestId);
  if (!r) throw Errors.notFound("ไม่พบคำขอนี้");
  const recipient: User = kind === "transfer_requested" ? r.to : r.from;

  const baseUrl = appBaseUrl(fallbackOrigin);
  const data: TransferMessageData = {
    requestId,
    assetName: r.asset.name,
    assetCode: r.asset.code,
    assetType: r.asset.type,
    fromName: r.from.fullName,
    toName: r.to.fullName,
    fromRoom: r.fromRoomCode,
    toRoom: r.toRoomCode,
    reason: r.req.reason,
    responseReason: r.req.responseReason,
  };
  const message =
    kind === "transfer_requested"
      ? transferRequestedMessage(data, { baseUrl, requestUrl: appLink(`/requests/${requestId}`, fallbackOrigin) })
      : kind === "transfer_accepted"
        ? transferAcceptedMessage(data, { baseUrl, assetUrl: appLink(`/assets/${r.asset.id}`, fallbackOrigin) })
        : transferRejectedMessage(data, { baseUrl, manageUrl: appLink(`/assets/${r.asset.id}/manage`, fallbackOrigin) });

  // หนึ่งแถวต่อ (คำขอ, ประเภท, ผู้รับ) — กันแจ้งเตือนซ้ำเมื่อกดซ้ำ
  await db
    .insert(notifications)
    .values({ requestId, recipientId: recipient.id, kind, payload: message })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.requestId, requestId),
        eq(notifications.kind, kind),
        eq(notifications.recipientId, recipient.id),
      ),
    );
  if (row.status === "sent") return { id: row.id, status: row.status, error: row.error };

  let status: NotifyOutcome["status"];
  let error: string | null = null;
  let httpStatus: number | null = null;

  if (kind !== "transfer_requested" && !recipient.notifyResult) {
    status = "skipped";
    error = "ผู้รับปิดการแจ้งเตือนเรื่องนี้ในหน้าบัญชี";
  } else if (!recipient.lineUserId) {
    status = "skipped";
    error = "ผู้รับยังไม่เชื่อม LINE";
  } else if (!isMessagingConfigured()) {
    status = "skipped";
    error = "ยังไม่ได้ตั้งค่า LINE_MESSAGING_CHANNEL_ACCESS_TOKEN";
  } else {
    const res = await pushMessage(recipient.lineUserId, [message], row.retryKey);
    status = res.ok ? "sent" : "failed";
    error = res.ok ? null : (res.error ?? "ส่งไม่สำเร็จ");
    httpStatus = res.status;
  }

  await db
    .update(notifications)
    .set({
      status,
      error,
      httpStatus,
      payload: message,
      attempts: sql`${notifications.attempts} + 1`,
      sentAt: status === "sent" ? new Date() : null,
    })
    .where(eq(notifications.id, row.id));
  return { id: row.id, status, error };
}

/** ผู้ส่งกด "ส่งแจ้งเตือนอีกครั้ง" สำหรับคำขอที่ยังรอตอบ */
export async function resendRequestNotification(user: User, requestId: string, fallbackOrigin?: string) {
  const r = await loadRequest(requestId);
  if (!r) throw Errors.notFound("ไม่พบคำขอนี้");
  if (r.req.fromUserId !== user.id) throw Errors.forbidden("เฉพาะผู้ส่งคำขอเท่านั้นที่ส่งแจ้งเตือนซ้ำได้");
  if (r.req.status !== "pending") {
    throw Errors.conflict("already_answered", "คำขอนี้ไม่อยู่ในสถานะรอตอบรับแล้ว");
  }
  return sendTransferNotification(requestId, "transfer_requested", fallbackOrigin);
}

/** ไม่ให้ข้อผิดพลาดของ LINE ทำให้รายการที่บันทึกแล้วดูเหมือนล้มเหลว */
export async function safeNotify(
  requestId: string,
  kind: NotificationKind,
  fallbackOrigin?: string,
): Promise<NotifyOutcome | null> {
  try {
    return await sendTransferNotification(requestId, kind, fallbackOrigin);
  } catch (e) {
    console.error("notify failed", e);
    return null;
  }
}
