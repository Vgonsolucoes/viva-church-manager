import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { authOptions } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout(props: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <MobileShell>{props.children}</MobileShell>;
}
