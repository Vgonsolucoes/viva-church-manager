import { Expo, type ExpoPushMessage, type ExpoPushReceipt } from "expo-server-sdk";
import type { MemberType, RoleKey } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

const expoClient = (() => {
  try {
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    return new Expo({ accessToken: accessToken || undefined });
  } catch {
    return null;
  }
})();

type PushTarget = {
  userIds?: string[];
  ministryIds?: string[];
  cellIds?: string[];
};

export async function createNotificationCampaign(
  params: {
    title: string;
    body: string;
    createdById?: string | null;
    targetRoles?: RoleKey[];
    targetMemberTypes?: MemberType[];
    channel?: "IN_APP" | "EMAIL" | "PUSH";
    deepLink?: string | null;
    scheduledAt?: Date | null;
    imageUrl?: string | null;
    targetUsersOverride?: PushTarget;
  },
) {
  const channel = params.channel ?? "IN_APP";
  const targetRoles = Array.from(new Set(params.targetRoles ?? []));
  const targetMemberTypes = Array.from(new Set(params.targetMemberTypes ?? []));

  const notification = await prisma.notification.create({
    data: {
      title: params.title.trim(),
      body: params.body.trim(),
      channel,
      targetRoles,
      targetMemberTypes,
      imageUrl: params.imageUrl ?? null,
      deepLink: params.deepLink ?? null,
      scheduledAt: params.scheduledAt ?? null,
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

  let userIds = Array.from(
    new Set([...roleUsers.map((u) => u.userId), ...memberTypeUsers.map((u) => u.id)]),
  );

  if (params.targetUsersOverride) {
    const extraUserIds = new Set<string>();
    if (params.targetUsersOverride.userIds?.length) {
      for (const id of params.targetUsersOverride.userIds) extraUserIds.add(id);
    }
    if (params.targetUsersOverride.ministryIds?.length) {
      const rows = await prisma.memberMinistry.findMany({
        where: { ministryId: { in: params.targetUsersOverride.ministryIds } },
        select: { member: { select: { user: { select: { id: true } } } } },
      });
      for (const r of rows) {
        const uid = r.member?.user?.id;
        if (uid) extraUserIds.add(uid);
      }
    }
    if (params.targetUsersOverride.cellIds?.length) {
      const cellRows = await prisma.cell.findMany({
        where: { id: { in: params.targetUsersOverride.cellIds } },
        select: {
          leader: { select: { user: { select: { id: true } } } },
          host: { select: { user: { select: { id: true } } } },
        },
      });
      for (const cell of cellRows) {
        if (cell.leader?.user?.id) extraUserIds.add(cell.leader.user.id);
        if (cell.host?.user?.id) extraUserIds.add(cell.host.user.id);
      }
    }
    const merged = Array.from(new Set([...userIds, ...Array.from(extraUserIds)]));
    userIds = merged;
  }

  if (!userIds.length && roleUsers.length + memberTypeUsers.length === 0 && !params.targetUsersOverride) {
    const allActive = await prisma.user.findMany({
      select: { id: true },
    });
    userIds = allActive.map((u) => u.id);
  }

  if (userIds.length) {
    await prisma.notificationDelivery.createMany({
      data: userIds.map((userId) => ({
        notificationId: notification.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  if (channel === "PUSH" && !params.scheduledAt) {
    await sendExpoPushToUsers(userIds, {
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl ?? undefined,
      deepLink: notification.deepLink ?? undefined,
    });
  }

  return notification;
}

export async function sendExpoPushChunked(messages: ExpoPushMessage[]) {
  if (!expoClient) return { sent: 0, receipts: [], deactivated: 0 };
  const chunks = expoClient.chunkPushNotifications(messages);
  const tickets: any[] = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expoClient.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch {
      continue;
    }
  }

  let deactivated = 0;
  const receiptIdChunks = expoClient.chunkPushNotificationReceiptIds(
    tickets.filter((t) => t && t.id).map((t) => t.id),
  );
  for (const chunk of receiptIdChunks) {
    try {
      const receipts: Record<string, ExpoPushReceipt> = await expoClient.getPushNotificationReceiptsAsync(chunk);
      for (const receiptId in receipts) {
        const receipt = receipts[receiptId];
        if (receipt.status === "error") {
          if (receipt.details?.error === "DeviceNotRegistered") {
            deactivated += 1;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return { sent: tickets.length, receipts: tickets, deactivated };
}

export async function sendExpoPushToUsers(
  userIds: string[],
  payload: {
    title: string;
    body: string;
    imageUrl?: string;
    deepLink?: string;
  },
) {
  if (!userIds.length) return { sent: 0, receipts: [], deactivated: 0 };
  const devices = await prisma.pushDevice.findMany({
    where: { userId: { in: userIds }, active: true },
    select: { expoPushToken: true, userId: true },
  });
  if (!devices.length) return { sent: 0, receipts: [], deactivated: 0 };

  const messages: ExpoPushMessage[] = devices.map((d) => ({
    to: d.expoPushToken,
    title: payload.title,
    body: payload.body,
    sound: "default",
    priority: "high",
    ...(payload.imageUrl ? { badge: 1 } : {}),
    data: {
      ...(payload.deepLink ? { deepLink: payload.deepLink } : {}),
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
  }));

  const result = await sendExpoPushChunked(messages);
  return result;
}

export async function sendScheduleReminders24h() {
  const now = new Date();
  const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const assignments = await prisma.scheduleAssignment.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      schedule: { startsAt: { gte: from, lte: to } },
    },
    include: {
      schedule: { include: { ministry: true } },
      volunteer: { include: { member: true } },
    },
  });
  const campaignIds = [];
  for (const a of assignments) {
    const startsAt = a.schedule.startsAt;
    const dateStr = startsAt.toLocaleString("pt-BR", {
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    const deepLink = `/(tabs)/escalas`;
    const body =
      `Lembrete: ${a.schedule.title}\n` +
      `${dateStr}\n` +
      (a.schedule.ministry?.name ? `Ministério: ${a.schedule.ministry.name}` : "") +
      `\nFunção: ${a.roleName}` +
      `\n\nToque para confirmar.`;
    const created = await createNotificationCampaign({
      title: "Lembrete de Escala (24h)",
      body,
      channel: "PUSH",
      deepLink,
      targetUsersOverride: { userIds: [a.volunteerId] },
    });
    campaignIds.push(created.id);
  }
  return { reminders: assignments.length, campaignIds };
}

export async function sendScheduleReminders2h() {
  const now = new Date();
  const from = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);
  const assignments = await prisma.scheduleAssignment.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      schedule: { startsAt: { gte: from, lte: to } },
    },
    include: { schedule: { include: { ministry: true } } },
  });
  const campaignIds = [];
  for (const a of assignments) {
    const startsAt = a.schedule.startsAt;
    const dateStr = startsAt.toLocaleString("pt-BR", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const body =
      `Faltam ~2h para: ${a.schedule.title}\n` +
      `${dateStr}\n` +
      (a.schedule.ministry?.name ? `Ministério: ${a.schedule.ministry.name}` : "") +
      `\nFunção: ${a.roleName}`;
    const created = await createNotificationCampaign({
      title: "Lembrete de Escala (2h)",
      body,
      channel: "PUSH",
      deepLink: `/(tabs)/escalas`,
      targetUsersOverride: { userIds: [a.volunteerId] },
    });
    campaignIds.push(created.id);
  }
  return { reminders: assignments.length, campaignIds };
}

export async function sendNewScheduleNotification(
  volunteerUserId: string,
  schedule: { id: string; title: string; startsAt: Date; ministryName?: string; roleName?: string },
  mode: "new" | "changed" | "cancelled" = "new",
) {
  const map: Record<typeof mode, { title: string; prefix: string }> = {
    new: { title: "Nova Escala", prefix: "Você foi escalado para" },
    changed: { title: "Escala Alterada", prefix: "Sua escala foi atualizada em" },
    cancelled: { title: "Escala Cancelada", prefix: "Sua escala foi cancelada em" },
  };
  const dateStr = schedule.startsAt.toLocaleString("pt-BR", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const body =
    `${map[mode].prefix}: ${schedule.title}.\n` +
    `${dateStr}\n` +
    (schedule.ministryName ? `Ministério: ${schedule.ministryName}\n` : "") +
    (schedule.roleName ? `Função: ${schedule.roleName}\n` : "") +
    `\nToque para confirmar.`;
  return createNotificationCampaign({
    title: map[mode].title,
    body,
    channel: "PUSH",
    deepLink: `/(tabs)/escalas`,
    targetUsersOverride: { userIds: [volunteerUserId] },
  });
}
