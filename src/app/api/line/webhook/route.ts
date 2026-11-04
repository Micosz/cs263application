import { NextResponse } from "next/server";
import { appLink } from "@/lib/line/config";
import { textMessage } from "@/lib/line/flex";
import { replyMessage, verifyWebhookSignature } from "@/lib/line/messaging";

type LineEvent = {
  type: string;
  replyToken?: string;
  message?: { type: string; text?: string };
};

/**
 * Webhook ของ LINE OA (ตั้งใน Messaging API channel → Webhook URL)
 * ตามดีไซน์ "กดอะไรใน LINE แล้วไปไหน": ข้อความที่พิมพ์ในแชทไม่บันทึกอะไร ระบบตอบชี้กลับไปที่ปุ่ม
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const origin = new URL(req.url).origin;

  await Promise.all(
    events.map(async (ev) => {
      if (!ev.replyToken) return;
      if (ev.type === "follow") {
        await replyMessage(ev.replyToken, [
          textMessage(
            `สวัสดีครับ บัญชีนี้ส่งแจ้งเตือนจากระบบติดตามครุภัณฑ์ของสาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยธรรมศาสตร์\n\nเข้าสู่ระบบและเชื่อมบัญชีครั้งเดียว แล้วคุณจะได้รับแจ้งในแชทนี้เมื่อมีคนส่งต่อครุภัณฑ์ให้คุณ\n${appLink("/", origin)}`,
          ),
        ]);
        return;
      }
      if (ev.type === "message" && ev.message?.type === "text") {
        const text = ev.message.text ?? "";
        const reply = /ติดต่อ|ผู้ดูแล/.test(text)
          ? "ติดต่อผู้ดูแลระบบ งานไอที ห้อง 213"
          : "ระบบยังไม่ได้บันทึกคำตอบ กรุณากด “ดูคำขอ” ในข้อความแจ้งเตือน แล้วยืนยันในหน้าที่เปิดขึ้น";
        await replyMessage(ev.replyToken, [textMessage(reply)]);
      }
    }),
  );
  return NextResponse.json({ ok: true });
}
