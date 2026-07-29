import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MobileShell } from "@/components/layout/MobileShell";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function AppLayout(props: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let resolvedAvatar = session.user?.image ?? null;
  if (session.uid && !resolvedAvatar) {
    const linked = await prisma.user.findUnique({
      where: { id: session.uid },
      select: {
        imageUrl: true,
        member: { select: { photoUrl: true } },
      },
    });
    resolvedAvatar = linked?.imageUrl ?? linked?.member?.photoUrl ?? null;
  }

  return (
    <MobileShell
      user={{
        name: session.user?.name ?? null,
        image: resolvedAvatar,
      }}
    >
      {props.children}
    </MobileShell>
  );
}
