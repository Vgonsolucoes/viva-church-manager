import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { z } from "zod";
import { churchDateKey, churchDateTime } from "@/lib/weekly-services";
import { activeNetworkBonds, directBonds, networkRoot } from "@/server/discipleship-network";

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export function selectedMonth(input?: string) {
  const result = monthSchema.safeParse(input);
  return result.success ? result.data : churchDateKey(new Date()).slice(0, 7);
}
export function monthlyRange(month: string) {
  const from = new Date(`${month}-01T00:00:00Z`);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);
  return { gte: churchDateTime(`${month}-01`, "00:00"), lt: churchDateTime(to.toISOString().slice(0, 10), "00:00") };
}
export async function monthlyLeaderContext(memberId: string | null | undefined) {
  if (!memberId) return null;
  const bonds = await activeNetworkBonds();
  const direct = directBonds(memberId, bonds);
  if (!direct.length) return null;
  const rootId = networkRoot(memberId, bonds);
  const rootCouple = bonds.some((bond) => bond.disciplerId === rootId && bond.coDisciplerId === memberId);
  const primary = direct.find((bond) => bond.coDisciplerId === memberId)?.disciplerId ?? memberId;
  return { memberId, rootId, canUpload: memberId === rootId || rootCouple, leaderId: primary, bonds };
}

export async function monthlySession() {
  const session = await getServerSession(authOptions);
  if (!session?.uid || !session.permissions?.some((p) => ["discipleship:my:read", "discipleships:read"].includes(p))) {
    throw new Error("Você não tem acesso ao módulo de discipulado.");
  }
  const user = await prisma.user.findUnique({ where: { id: session.uid }, select: { memberId: true } });
  return { session, context: await monthlyLeaderContext(user?.memberId) };
}
