import { StateCard, TopBar } from "@/components/bits";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { fmtDateTime, requestCode } from "@/lib/format";
import { getRequestDetail } from "@/services/queries";
import { RequestView } from "./RequestView";

export const metadata = { title: "คำขอส่งต่อ" };

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let r: Awaited<ReturnType<typeof getRequestDetail>>;
  try {
    r = await getRequestDetail(user, id);
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    return (
      <>
        <TopBar title="คำขอส่งต่อ" back="/requests" />
        <StateCard
          title={e.status === 403 ? "ไม่ใช่ผู้รับที่ระบุ" : "ไม่พบคำขอ"}
          message={e.message}
          action={{ href: "/requests", label: "กลับไปคำขอ" }}
        />
      </>
    );
  }
  const role = r.toUserId === user.id ? "recipient" : r.fromUserId === user.id ? "sender" : "viewer";
  return (
    <>
      <TopBar
        title="คำขอส่งต่อ"
        back="/requests"
        right={<span className="mono" style={{ fontSize: 12.5 }}>{requestCode(r.seq, r.createdAt)}</span>}
      />
      <RequestView
        role={role}
        me={{ id: user.id, fullName: user.fullName, avatarBg: user.avatarBg, avatarFg: user.avatarFg }}
        req={{
          id: r.id,
          status: r.status,
          reason: r.reason,
          responseReason: r.responseReason,
          createdAtText: fmtDateTime(r.createdAt),
          respondedAtText: r.respondedAt ? fmtDateTime(r.respondedAt) : null,
          from: r.from,
          to: r.to,
          fromRoomCode: r.fromRoomCode,
          toRoomCode: r.toRoomCode,
          currentRoomCode: r.currentRoomCode,
          asset: r.asset,
          notification: r.notification,
        }}
      />
    </>
  );
}
