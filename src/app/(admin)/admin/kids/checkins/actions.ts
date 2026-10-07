"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { hasPermission, type RoleKey } from "@/server/rbac";

export async function checkOutFromPanel(formData: FormData) {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as RoleKey[];
  if (!session?.uid || !hasPermission(roles, "kids:write")) return;

  const checkInId = String(formData.get("checkInId") ?? "");
  if (!checkInId) return;

  const checkIn = await prisma.childCheckIn.findUnique({ where: { id: checkInId } });
  if (!checkIn || checkIn.status !== "CHECKED_IN") return;

  const before = { status: checkIn.status, checkOutAt: checkIn.checkOutAt };

  const updated = await prisma.childCheckIn.update({
    where: { id: checkInId },
    data: { status: "CHECKED_OUT", checkOutAt: new Date() },
  });

  await logAudit({
    actorUserId: session.uid,
    action: "CHECKOUT",
    entityType: "ChildCheckIn",
    entityId: updated.id,
    before,
    after: { status: updated.status, checkOutAt: updated.checkOutAt },
  });

  revalidatePath("/admin/kids/checkins");
  revalidatePath("/admin/kids");
}
