import { SideNav } from "@/components/Nav";
import { requireUser } from "@/lib/auth";
import { countIncomingPending } from "@/services/queries";

export default async function MainLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const badge = await countIncomingPending(user.id);
  return (
    <div className="shell">
      <SideNav
        badge={badge}
        user={{
          fullName: user.fullName,
          position: user.position,
          avatarBg: user.avatarBg,
          avatarFg: user.avatarFg,
        }}
      />
      <main className="main">{children}</main>
    </div>
  );
}
