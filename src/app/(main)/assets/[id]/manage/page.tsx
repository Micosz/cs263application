import { StateCard, TopBar } from "@/components/bits";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { fmtDateTime } from "@/lib/format";
import { getAssetDetail, listColleagues, listRoomsForUser } from "@/services/queries";
import { ManageFlow } from "./ManageFlow";

export const metadata = { title: "ย้าย / ส่งต่อ" };

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  let d: Awaited<ReturnType<typeof getAssetDetail>>;
  try {
    d = await getAssetDetail(user, id);
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    return (
      <>
        <TopBar title="ย้าย / ส่งต่อ" back="/mine" />
        <StateCard title={e.status === 403 ? "ไม่มีสิทธิ์เข้าถึง" : "ไม่พบรายการ"} message={e.message} action={{ href: "/mine", label: "กลับไปครุภัณฑ์ของฉัน" }} />
      </>
    );
  }
  if (!d.canManage) {
    return (
      <>
        <TopBar title="ย้าย / ส่งต่อ" back={`/assets/${id}`} />
        <StateCard
          title="ไม่มีสิทธิ์เข้าถึง"
          message="เฉพาะผู้รับผิดชอบครุภัณฑ์ชิ้นนี้เท่านั้นที่ย้ายห้องหรือส่งต่อได้"
          action={{ href: "/mine", label: "กลับไปครุภัณฑ์ของฉัน" }}
        />
      </>
    );
  }
  const [people, rooms] = await Promise.all([listColleagues(user), listRoomsForUser(user)]);
  const mode = sp.mode === "room" || sp.mode === "person" || sp.mode === "both" ? sp.mode : "both";

  return (
    <ManageFlow
      me={{ id: user.id, fullName: user.fullName, avatarBg: user.avatarBg, avatarFg: user.avatarFg }}
      asset={{
        id: d.asset.id,
        code: d.asset.code,
        name: d.asset.name,
        type: d.asset.typeKey,
        roomId: d.room.id,
        roomCode: d.room.code,
      }}
      people={people}
      rooms={rooms}
      pending={
        d.pending
          ? { id: d.pending.id, toName: d.pending.toUser.fullName, createdAtText: fmtDateTime(d.pending.createdAt) }
          : null
      }
      initialMode={mode}
    />
  );
}
