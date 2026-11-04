const TZ = "Asia/Bangkok";

const dayMonth = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
});
const dayMonthYear = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dayMonthYear2 = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "2-digit",
});
const hourMinute = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const yearOnly = new Intl.DateTimeFormat("th-TH", {
  timeZone: TZ,
  year: "numeric",
});

/** "30 ต.ค." */
export const fmtDay = (d: Date) => dayMonth.format(d);
/** "30 ต.ค. 2569" (th-TH ใช้ปีพุทธศักราชอยู่แล้ว) */
export const fmtDate = (d: Date) => dayMonthYear.format(d);
/** "3 ก.ย. 69" */
export const fmtDateShort = (d: Date) => dayMonthYear2.format(d);
/** "14:12 น." */
export const fmtTime = (d: Date) => `${hourMinute.format(d)} น.`;
/** "30 ต.ค. 2569 เวลา 14:12 น." */
export const fmtDateTime = (d: Date) => `${fmtDate(d)} เวลา ${fmtTime(d)}`;

/** ปี พ.ศ. ตามเวลาไทย */
export function beYear(d: Date): number {
  const digits = yearOnly.format(d).replace(/\D/g, "");
  return Number(digits);
}

/** เลขที่คำขอ R-2569-0418 */
export function requestCode(seq: number, createdAt: Date) {
  return `R-${beYear(createdAt)}-${String(seq).padStart(4, "0")}`;
}

/** "คุณอารีย์ สุขใจ" → "คุณอารีย์" */
export function shortName(fullName: string) {
  return fullName.split(" ")[0] ?? fullName;
}

/** ตัวอักษรแรกหลังคำว่า "คุณ" สำหรับรูปประจำตัว */
export function initialOf(fullName: string) {
  const n = fullName.replace(/^คุณ/, "").trim();
  return Array.from(n)[0] ?? "?";
}

export function roomLabel(room: { code: string; name: string }) {
  return room.name ? `${room.code} ${room.name}` : room.code;
}

/** ข้อความทักทายตามช่วงเวลาไทย */
export function greeting(now = new Date()) {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

export function fmtNumber(n: number) {
  return n.toLocaleString("th-TH");
}
