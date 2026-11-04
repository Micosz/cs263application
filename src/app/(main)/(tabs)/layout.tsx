import { BottomNav } from "@/components/Nav";
import { requireUser } from "@/lib/auth";
import { countIncomingPending } from "@/services/queries";

export default async function TabsLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const badge = await countIncomingPending(user.id);
  return (
    <div className="with-nav">
      {children}
      <BottomNav badge={badge} />
    </div>
  );
}
