import { prisma } from "@/server/db";
import { accessFromMinistries } from "@/lib/projection";

// Consultado a cada operação: retirar o vínculo revoga o acesso imediatamente.
// Papéis no token não substituem a participação no ministério.
export async function getProjectionAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { member: { select: {
      ministry: { select: { active: true, projectionChannel: true } },
      memberMinistries: { select: { ministry: { select: { active: true, projectionChannel: true } } } },
      ministriesLeading: { select: { active: true, projectionChannel: true } },
      volunteerProfile: { select: { ministry: { select: { active: true, projectionChannel: true } } } },
    } } },
  });
  const member = user?.member;
  return accessFromMinistries(member ? [
    ...(member.ministry ? [member.ministry] : []),
    ...(member.volunteerProfile?.ministry ? [member.volunteerProfile.ministry] : []),
    ...member.memberMinistries.map(link => link.ministry),
    ...member.ministriesLeading,
  ] : []);
}
