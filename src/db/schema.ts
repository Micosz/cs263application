import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** สาขา/หน่วยงาน — ใช้กำหนดว่าใครเห็นครุภัณฑ์ห้องไหนได้ */
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** ชื่อผู้ใช้ TU เช่น aree.s */
  username: text("username").notNull().unique(),
  /** ชื่อที่แสดง เช่น "คุณอารีย์ สุขใจ" */
  fullName: text("full_name").notNull(),
  position: text("position").notNull().default(""),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id),
  /** staff = บุคลากรทั่วไป, admin = ผู้ดูแลระบบ (เห็นครุภัณฑ์ทุกสาขา) */
  role: text("role", { enum: ["staff", "admin"] }).notNull().default("staff"),
  avatarBg: text("avatar_bg").notNull().default("#E3E3EA"),
  avatarFg: text("avatar_fg").notNull().default("#3A3A48"),
  active: boolean("active").notNull().default(true),
  /** LINE userId (sub ใน ID token) ของบัญชีที่ผูกไว้ */
  lineUserId: text("line_user_id").unique(),
  lineDisplayName: text("line_display_name"),
  lineLinkedAt: timestamp("line_linked_at", { withTimezone: true }),
  /** รหัสเชื่อมบัญชีแบบใช้ครั้งเดียว (เก็บเป็น SHA-256) ออกโดยผู้ดูแลระบบ */
  linkCodeHash: text("link_code_hash"),
  linkCodeExpiresAt: timestamp("link_code_expires_at", { withTimezone: true }),
  linkFailedAttempts: integer("link_failed_attempts").notNull().default(0),
  notifyReview: boolean("notify_review").notNull().default(true),
  notifyResult: boolean("notify_result").notNull().default(true),
  createdAt: createdAt(),
});

export const rooms = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull().default(""),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
  },
  (t) => [uniqueIndex("rooms_department_code_uq").on(t.departmentId, t.code)],
);

export const assetTypes = pgTable("asset_types", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** เลขครุภัณฑ์ เช่น 7440-001-0012/66 */
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    typeKey: text("type_key")
      .notNull()
      .references(() => assetTypes.key),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id),
    /** ผู้รับผิดชอบปัจจุบัน */
    custodianId: uuid("custodian_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("assets_custodian_idx").on(t.custodianId),
    index("assets_room_idx").on(t.roomId),
  ],
);

export const TRANSFER_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** คำขอส่งต่อผู้รับผิดชอบ (อาจย้ายห้องพร้อมกันเมื่อผู้รับตอบรับ) */
export const transferRequests = pgTable(
  "transfer_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** เลขลำดับสำหรับเลขที่คำขอ R-2569-0001 */
    seq: serial("seq").notNull().unique(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id),
    /** ห้องตอนส่งคำขอ */
    fromRoomId: integer("from_room_id")
      .notNull()
      .references(() => rooms.id),
    /** ห้องใหม่เมื่อผู้รับตอบรับ (null = ไม่ย้ายห้อง) */
    toRoomId: integer("to_room_id").references(() => rooms.id),
    reason: text("reason").notNull(),
    status: text("status", { enum: TRANSFER_STATUSES })
      .notNull()
      .default("pending"),
    responseReason: text("response_reason"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [
    // ครุภัณฑ์หนึ่งชิ้นมีคำขอที่รอตอบได้ครั้งละหนึ่งคำขอเท่านั้น
    uniqueIndex("transfer_one_pending_per_asset")
      .on(t.assetId)
      .where(sql`${t.status} = 'pending'`),
    index("transfer_to_user_idx").on(t.toUserId, t.status),
    index("transfer_from_user_idx").on(t.fromUserId, t.status),
  ],
);

export const EVENT_KINDS = [
  "room_moved",
  "transfer_requested",
  "transfer_accepted",
  "transfer_rejected",
  "transfer_cancelled",
  "reviewed",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const REVIEW_RESULTS = ["ok", "broken", "missing"] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

/** ประวัติของครุภัณฑ์ (append-only ยกเว้นผลทบทวนที่แก้ได้ในรอบเดียวกัน) */
export const assetEvents = pgTable(
  "asset_events",
  {
    id: serial("id").primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    kind: text("kind", { enum: EVENT_KINDS }).notNull(),
    /** ผู้ทำรายการ */
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    fromRoomId: integer("from_room_id").references(() => rooms.id),
    toRoomId: integer("to_room_id").references(() => rooms.id),
    fromUserId: uuid("from_user_id").references(() => users.id),
    toUserId: uuid("to_user_id").references(() => users.id),
    reason: text("reason"),
    requestId: uuid("request_id").references(() => transferRequests.id),
    reviewResult: text("review_result", { enum: REVIEW_RESULTS }),
    /** กันบันทึกซ้ำเมื่อกดยืนยันซ้ำ */
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: createdAt(),
  },
  (t) => [
    index("asset_events_asset_idx").on(t.assetId, t.createdAt),
    uniqueIndex("asset_events_request_kind_uq").on(t.requestId, t.kind),
  ],
);

export const reviewRounds = pgTable("review_rounds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
});

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    roundId: integer("round_id")
      .notNull()
      .references(() => reviewRounds.id),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => users.id),
    result: text("result", { enum: REVIEW_RESULTS }).notNull(),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("reviews_round_asset_uq").on(t.roundId, t.assetId)],
);

export const NOTIFICATION_STATUSES = [
  "pending",
  "sent",
  "failed",
  "skipped",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_KINDS = [
  "transfer_requested",
  "transfer_accepted",
  "transfer_rejected",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** บันทึกผลการส่งข้อความ LINE ตามจริง */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").references(() => transferRequests.id),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    channel: text("channel").notNull().default("line"),
    status: text("status", { enum: NOTIFICATION_STATUSES })
      .notNull()
      .default("pending"),
    error: text("error"),
    httpStatus: integer("http_status"),
    payload: jsonb("payload"),
    /** X-Line-Retry-Key กันส่งซ้ำเมื่อส่งใหม่ */
    retryKey: uuid("retry_key").notNull().defaultRandom(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("notifications_request_kind_recipient_uq").on(
      t.requestId,
      t.kind,
      t.recipientId,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 ของ token ใน cookie */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    via: text("via", { enum: ["line", "liff", "dev"] }).notNull(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type TransferRequest = typeof transferRequests.$inferSelect;
