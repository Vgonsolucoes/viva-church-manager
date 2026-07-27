import type { MemberType, RoleKey } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

export async function createNotificationCampaign(params: {
  title: string;
  body: string;
  createdById?: string | null;
  targetRoles?: RoleKey[];
  targetMemberTypes?: MemberType[];
}) {
  const targetRoles = Array.from(new Set(params.targetRoles ?? []));
  const targetMemberTypes = Array.from(new Set(params.targetMemberTypes ?? []));

  const notification = await prisma.notification.create({
    data: {
      title: params.title.trim(),
      body: params.body.trim(),
      channel: "IN_APP",
      targetRoles,
      targetMemberTypes,
      createdById: params.createdById ?? null,
    },
  });

  const roleUsers = targetRoles.length
    ? await prisma.userRole.findMany({
        where: { role: { in: targetRoles } },
        select: { userId: true },
        distinct: ["userId"],
      })
    : [];

  const memberTypeUsers = targetMemberTypes.length
    ? await prisma.user.findMany({
        where: {
          member: {
            OR: [
              { types: { hasSome: targetMemberTypes } },
              { type: { in: targetMemberTypes } },
            ],
          },
        },
        select: { id: true },
      })
    : [];

  const userIds = Array.from(
    new Set([...roleUsers.map((u) => u.userId), ...memberTypeUsers.map((u) => u.id)]),
  );

  if (userIds.length) {
    await prisma.notificationDelivery.createMany({
      data: userIds.map((userId) => ({
        notificationId: notification.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  return notification;
}
