import type { User } from "@/db/schema";

/**
 * นโยบายสิทธิ์ (ตรวจที่ server ทุกครั้ง)
 * - ดูครุภัณฑ์: ผู้ดูแลระบบเห็นทั้งหมด, บุคลากรเห็นครุภัณฑ์ในห้องของสาขาตัวเอง และชิ้นที่ตนรับผิดชอบ
 * - เริ่มย้ายห้อง/ส่งต่อ: เฉพาะผู้รับผิดชอบปัจจุบันของชิ้นนั้น
 * - ตอบคำขอ: เฉพาะผู้รับที่ระบุในคำขอ
 * - ดูคำขอ: ผู้ส่ง ผู้รับ หรือผู้ดูแลระบบ
 */
export function canViewAsset(
  user: Pick<User, "id" | "role" | "departmentId">,
  asset: { custodianId: string; roomDepartmentId: number },
) {
  return (
    user.role === "admin" ||
    asset.custodianId === user.id ||
    asset.roomDepartmentId === user.departmentId
  );
}

export function canViewRequest(
  user: Pick<User, "id" | "role">,
  req: { fromUserId: string; toUserId: string },
) {
  return user.role === "admin" || req.fromUserId === user.id || req.toUserId === user.id;
}
