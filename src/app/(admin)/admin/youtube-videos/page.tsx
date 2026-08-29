import { getServerSession } from "next-auth";
import { prisma } from "@/server/db";
import { hasPermission } from "@/server/rbac";
import { authOptions } from "@/server/auth";
import { getYoutubeConfig, resolveChannelId } from "@/server/youtube";
import { YoutubeVideosClient, type YoutubeVideoRow } from "./YoutubeVideosClient";

export const dynamic = "force-dynamic";

export default async function YoutubeVideosAdminPage() {
  const session = await getServerSession(authOptions);
  const roles = (session?.roles ?? []) as Parameters<typeof hasPermission>[0];
  const canRead = hasPermission(roles, "youtube:read");
  const canWrite = hasPermission(roles, "youtube:write");

  const videosDb = canRead
    ? await prisma.youtubeVideo.findMany({
        orderBy: { publishedAt: "desc" },
        take: 500,
      })
    : [];

  const videos: YoutubeVideoRow[] = videosDb.map((v) => ({
    id: v.id,
    youtubeId: v.youtubeId,
    title: v.title,
    description: v.description,
    thumbnailUrl: v.thumbnailUrl,
    publishedAt: v.publishedAt.toISOString(),
    duration: v.duration,
    viewCount: v.viewCount ?? null,
    visibleOnSite: v.visibleOnSite,
    syncStatus: v.syncStatus,
    syncError: v.syncError,
  }));

  const cfg = getYoutubeConfig();
  const channelId = await resolveChannelId();

  return (
    <YoutubeVideosClient
      videos={videos}
      canWrite={canWrite}
      channelHandle={cfg.defaultHandle}
      hasApiKey={cfg.hasApiKey}
      channelIdSet={Boolean(channelId)}
    />
  );
}
