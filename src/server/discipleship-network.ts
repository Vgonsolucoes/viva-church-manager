import { prisma } from "@/server/db";

export type NetworkBond = { id: string; discipleId: string; disciplerId: string; coDisciplerId: string | null };

export function descendantIds(memberId: string, bonds: NetworkBond[]) {
  const ids = new Set([memberId]);
  const pending = [memberId];
  while (pending.length) {
    const parent = pending.pop()!;
    for (const bond of bonds) {
      if ((bond.disciplerId === parent || bond.coDisciplerId === parent) && !ids.has(bond.discipleId)) {
        ids.add(bond.discipleId);
        pending.push(bond.discipleId);
      }
    }
  }
  return ids;
}

export async function activeNetworkBonds() {
  return prisma.discipleship.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, discipleId: true, disciplerId: true, coDisciplerId: true },
  });
}

export function networkRoot(memberId: string, bonds: NetworkBond[]) {
  let current = memberId;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const parent = bonds.find((bond) => bond.discipleId === current);
    if (parent) { current = parent.disciplerId; continue; }
    const couple = bonds.find((bond) => bond.coDisciplerId === current);
    if (couple && !seen.has(couple.disciplerId)) { current = couple.disciplerId; continue; }
    return current;
  }
  throw new Error("A rede contém um ciclo. Revise os vínculos antes de continuar.");
}

export function directBonds(memberId: string, bonds: NetworkBond[]) {
  return bonds.filter((bond) => bond.disciplerId === memberId || bond.coDisciplerId === memberId);
}

export async function canManageDiscipleship(
  session: { uid?: string; roles?: string[] },
  bond: { disciplerId: string; coDisciplerId?: string | null },
) {
  if (session.roles?.includes("SUPER_ADMIN")) return true;
  if (!session.uid) return false;
  const user = await prisma.user.findUnique({ where: { id: session.uid }, select: { memberId: true } });
  if (!user?.memberId) return false;
  const bonds = await activeNetworkBonds();
  const ids = descendantIds(user.memberId, bonds);
  const existingCouple = bonds.some((row) =>
    row.disciplerId === bond.disciplerId && row.coDisciplerId === bond.coDisciplerId,
  );
  return (ids.has(bond.disciplerId) && (!bond.coDisciplerId || ids.has(bond.coDisciplerId) || existingCouple))
    || !!bond.coDisciplerId && ids.has(bond.coDisciplerId) && existingCouple;
}
