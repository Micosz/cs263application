/** ข้อผิดพลาดที่ตั้งใจส่งกลับให้ผู้ใช้ (ข้อความภาษาไทยแสดงได้ทันที) */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthenticated: () =>
    new AppError(401, "unauthenticated", "กรุณาเข้าสู่ระบบก่อน"),
  forbidden: (msg = "คุณไม่มีสิทธิ์เข้าถึงรายการนี้") =>
    new AppError(403, "forbidden", msg),
  notFound: (msg = "ไม่พบรายการนี้") => new AppError(404, "not_found", msg),
  invalid: (msg = "ข้อมูลไม่ครบ") => new AppError(400, "invalid", msg),
  conflict: (code: string, msg: string) => new AppError(409, code, msg),
};

/** ตรวจ unique violation ของ PostgreSQL (drizzle ห่อ error ไว้ใน cause) */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    const err = cur as { code?: string; constraint?: string; cause?: unknown };
    if (err.code === "23505") {
      return !constraint || err.constraint === constraint;
    }
    cur = err.cause;
  }
  return false;
}
