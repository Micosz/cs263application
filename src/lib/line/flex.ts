import type { LineMessage } from "./messaging";

/** ข้อมูลที่ข้อความแจ้งเตือนใช้ (ดึงจากคำขอในฐานข้อมูล) */
export type TransferMessageData = {
  requestId: string;
  assetName: string;
  assetCode: string;
  assetType: string;
  fromName: string; // "คุณนภา ศรีสุข"
  toName: string;
  fromRoom: string; // "304"
  toRoom: string | null; // null = ไม่ย้ายห้อง
  reason: string;
  responseReason?: string | null;
};

const C = {
  ink: "#17171A",
  muted: "#55555F",
  red: "#C3002F",
  green: "#4F6A2A",
  thumb: "#F1F1F4",
};

const first = (full: string) => full.split(" ")[0] ?? full;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function row(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "md",
    contents: [
      { type: "text", text: label, size: "sm", color: C.muted, flex: 3 },
      { type: "text", text: value || "-", size: "sm", color: C.ink, flex: 7, wrap: true },
    ],
  };
}

/** รูปประเภทครุภัณฑ์ (LINE รับเฉพาะ HTTPS + PNG/JPEG จึงใส่เมื่อเว็บอยู่บน HTTPS เท่านั้น) */
function hero(baseUrl: string, type: string) {
  if (!baseUrl.startsWith("https://")) return undefined;
  return {
    type: "image",
    url: `${baseUrl}/types/${type}.png`,
    size: "full",
    aspectRatio: "20:9",
    aspectMode: "fit",
    backgroundColor: C.thumb,
  };
}

function button(label: string, uri: string, primary = true) {
  return {
    type: "button",
    style: primary ? "primary" : "secondary",
    color: primary ? C.red : undefined,
    height: "sm",
    action: { type: "uri", label, uri },
  };
}

function bubble(parts: { hero?: object; body: object[]; footer: object[] }) {
  return {
    type: "bubble",
    ...(parts.hero ? { hero: parts.hero } : {}),
    body: { type: "box", layout: "vertical", spacing: "sm", contents: parts.body },
    footer: { type: "box", layout: "vertical", spacing: "sm", contents: parts.footer },
  };
}

/** L2 · แจ้ง B ว่ามีคำขอส่งต่อถึงคุณ พร้อมปุ่ม "ดูคำขอ" */
export function transferRequestedMessage(
  d: TransferMessageData,
  opts: { baseUrl: string; requestUrl: string },
): LineMessage {
  const from = first(d.fromName);
  const roomText = d.toRoom
    ? `ย้ายจาก ${d.fromRoom} มา ${d.toRoom}`
    : `อยู่ห้อง ${d.fromRoom} เหมือนเดิม`;
  return {
    type: "flex",
    altText: clip(`${from}ขอส่งต่อ ${d.assetName} ให้คุณ`, 400),
    contents: bubble({
      hero: hero(opts.baseUrl, d.assetType),
      body: [
        { type: "text", text: `${from}ขอส่งต่อครุภัณฑ์ให้คุณ`, weight: "bold", size: "md", wrap: true },
        { type: "text", text: d.assetName, weight: "bold", size: "sm", wrap: true },
        { type: "text", text: d.assetCode, size: "xs", color: C.muted },
        { type: "separator", margin: "md" },
        row("ผู้ดูแลใหม่", `คุณ (เดิมคือ${from})`),
        row("ห้อง", roomText),
        row("เหตุผล", clip(d.reason, 300)),
      ],
      footer: [button("ดูคำขอ", opts.requestUrl)],
    }),
  };
}

/** L3 · แจ้ง A ว่า B ตอบรับแล้ว */
export function transferAcceptedMessage(
  d: TransferMessageData,
  opts: { baseUrl: string; assetUrl: string },
): LineMessage {
  const to = first(d.toName);
  const roomText = d.toRoom
    ? `ย้ายจาก ${d.fromRoom} ไป ${d.toRoom}`
    : `อยู่ห้อง ${d.fromRoom} เหมือนเดิม`;
  return {
    type: "flex",
    altText: clip(`${to}รับ ${d.assetName} แล้ว`, 400),
    contents: bubble({
      hero: hero(opts.baseUrl, d.assetType),
      body: [
        { type: "text", text: "ตอบรับ", weight: "bold", size: "sm", color: C.green },
        { type: "text", text: `${to}รับ ${d.assetName} แล้ว`, weight: "bold", size: "md", wrap: true },
        { type: "separator", margin: "md" },
        row("ผู้ดูแลใหม่", to),
        row("ห้อง", roomText),
        { type: "text", text: "รายการนี้ออกจากความรับผิดชอบของคุณแล้ว", size: "sm", color: C.muted, wrap: true, margin: "md" },
      ],
      footer: [button("ดูประวัติครุภัณฑ์", opts.assetUrl)],
    }),
  };
}

/** L3 · แจ้ง A ว่า B ปฏิเสธ */
export function transferRejectedMessage(
  d: TransferMessageData,
  opts: { baseUrl: string; manageUrl: string },
): LineMessage {
  const to = first(d.toName);
  return {
    type: "flex",
    altText: clip(`${to}ไม่รับ ${d.assetName}`, 400),
    contents: bubble({
      hero: hero(opts.baseUrl, d.assetType),
      body: [
        { type: "text", text: "ปฏิเสธ", weight: "bold", size: "sm", color: C.red },
        { type: "text", text: `${to}ไม่รับ ${d.assetName}`, weight: "bold", size: "md", wrap: true },
        { type: "text", text: `เหตุผล: ${clip(d.responseReason ?? "-", 300)}`, size: "sm", wrap: true, margin: "md" },
        { type: "text", text: `ทุกอย่างคงเดิม เครื่องยังอยู่กับคุณที่ห้อง ${d.fromRoom}`, size: "sm", color: C.muted, wrap: true },
      ],
      // label ปุ่มสั้นไว้ไม่เกิน 20 ตัวอักษร (ข้อจำกัดที่เข้มที่สุดของ LINE action label)
      footer: [button("ส่งต่อให้คนอื่น", opts.manageUrl)],
    }),
  };
}

export const textMessage = (text: string): LineMessage => ({ type: "text", text: clip(text, 5000) });
