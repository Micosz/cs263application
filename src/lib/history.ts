import type { HistoryRow } from "@/services/queries";
import { shortName } from "./format";

const REVIEW_TEXT = {
  ok: "ทบทวนแล้ว เจอและใช้งานได้",
  broken: "ทบทวนแล้ว เจอแต่ชำรุด",
  missing: "ทบทวนแล้ว ไม่เจอ",
} as const;

/** แปลงเหตุการณ์ในประวัติเป็นข้อความที่อ่านเข้าใจ (ใช้ "คุณ" แทนชื่อผู้ที่กำลังดู) */
export function describeEvent(e: HistoryRow, viewerId: string): { text: string; sub?: string } {
  const who = (u: { id: string | null; fullName: string | null } | null) =>
    !u?.id ? "" : u.id === viewerId ? "คุณ" : shortName(u.fullName ?? "");
  const by = `โดย${who(e.actor)}`;
  const reason = e.reason ? `เหตุผล: ${e.reason}` : undefined;
  const join = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(" · ");

  switch (e.kind) {
    case "room_moved":
      return { text: `ย้ายจากห้อง ${e.fromRoom} มาห้อง ${e.toRoom}`, sub: join(by, reason) };
    case "transfer_requested":
      return {
        text: `${who(e.actor)}ขอส่งต่อให้${who(e.toUser)}${e.toRoom ? ` และย้ายไปห้อง ${e.toRoom}` : ""}`,
        sub: reason,
      };
    case "transfer_accepted":
      return {
        text: `${who(e.toUser)}รับต่อจาก${who(e.fromUser)}${
          e.toRoom && e.fromRoom !== e.toRoom ? ` ย้ายจากห้อง ${e.fromRoom} ไป ${e.toRoom}` : ""
        }`,
      };
    case "transfer_rejected":
      return { text: `${who(e.toUser)}ไม่รับคำขอจาก${who(e.fromUser)}`, sub: reason };
    case "transfer_cancelled":
      return { text: `${who(e.actor)}ยกเลิกคำขอส่งต่อให้${who(e.toUser)}` };
    case "reviewed":
      return {
        text: REVIEW_TEXT[e.reviewResult ?? "ok"],
        sub: join(e.toRoom ? `ห้อง ${e.toRoom}` : undefined, by, e.reason ? `อาการ: ${e.reason}` : undefined),
      };
    default:
      return { text: e.kind };
  }
}

export const REVIEW_LABEL = { ok: "เจอ ใช้งานได้", broken: "เจอ แต่ชำรุด", missing: "ไม่เจอ" } as const;
