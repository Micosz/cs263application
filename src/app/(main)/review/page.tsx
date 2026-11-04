import { StateCard, TopBar } from "@/components/bits";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { getNextRound, listMyAssets } from "@/services/queries";
import { ReviewFlow } from "./ReviewFlow";

export const metadata = { title: "ทบทวนรอบนี้" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { rows, round } = await listMyAssets(user);

  if (!round) {
    const next = await getNextRound();
    return (
      <>
        <TopBar title="ทบทวนรอบนี้" back="/mine" />
        <StateCard
          title="ไม่อยู่ในรอบทบทวน"
          message={next ? `รอบถัดไปเปิด ${fmtDate(next.startsAt)} ระบบจะแจ้งในแชทเมื่อเปิดรอบ` : "ยังไม่มีกำหนดรอบทบทวนถัดไป"}
          action={{ href: "/mine", label: "กลับไปครุภัณฑ์ของฉัน" }}
        />
      </>
    );
  }

  // เริ่มที่ชิ้นที่เลือก (ทบทวนซ้ำได้) แล้วต่อด้วยชิ้นที่ยังไม่ทบทวน
  const picked = sp.asset ? rows.find((r) => r.id === sp.asset) : undefined;
  const todo = rows.filter((r) => !r.reviewedAt && r.id !== picked?.id);
  const items = (picked ? [picked, ...todo] : todo).map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    roomCode: r.roomCode,
  }));

  if (!items.length) {
    return (
      <>
        <TopBar title="ทบทวนรอบนี้" back="/mine" />
        <StateCard
          title="ทบทวนครบแล้ว"
          message={rows.length ? `รอบนี้คุณทบทวนครบ ${rows.length} จาก ${rows.length} รายการแล้ว` : "ยังไม่มีครุภัณฑ์ที่คุณรับผิดชอบ"}
          action={{ href: "/mine", label: "กลับไปครุภัณฑ์ของฉัน" }}
        />
      </>
    );
  }
  const reviewedBefore = rows.filter((r) => r.reviewedAt && r.id !== picked?.id).length;
  return <ReviewFlow items={items} totalMine={rows.length} reviewedBefore={reviewedBefore} />;
}
