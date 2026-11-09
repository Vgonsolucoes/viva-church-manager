import { prisma } from "@/server/db";
import { fetchChannelVideos } from "@/server/youtube";

export async function syncYoutubeLibrary(options: { manual?: boolean; userId?: string } = {}) {
  const videos = await fetchChannelVideos({
    maxResults: options.manual ? 200 : 50,
    preferRss: !options.manual,
  });
  if (!videos.length) return null;

  const existing = new Map((await prisma.youtubeVideo.findMany({
    where: { youtubeId: { in: videos.map((video) => video.youtubeId) } },
    select: {
      youtubeId: true, title: true, description: true, thumbnailUrl: true,
      publishedAt: true, duration: true, viewCount: true, syncStatus: true,
    },
  })).map((video) => [video.youtubeId, video]));
  let imported = 0;
  let updated = 0;
  for (const video of videos) {
    const previous = existing.get(video.youtubeId);
    if (previous && previous.title === video.title &&
      previous.description === (video.description ?? null) &&
      previous.thumbnailUrl === (video.thumbnailUrl ?? null) &&
      previous.publishedAt.getTime() === video.publishedAt.getTime() &&
      (video.duration == null || previous.duration === video.duration) &&
      (video.viewCount == null || previous.viewCount === video.viewCount) &&
      previous.syncStatus === "SYNCED") continue;

    const metadata = {
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      syncStatus: "SYNCED" as const,
    };
    await prisma.youtubeVideo.upsert({
      where: { youtubeId: video.youtubeId },
      create: {
        ...metadata, youtubeId: video.youtubeId, visibleOnSite: true,
        duration: video.duration, viewCount: video.viewCount ?? 0, syncedById: options.userId,
      },
      update: {
        ...metadata, duration: video.duration ?? undefined,
        viewCount: video.viewCount ?? undefined, syncedById: options.userId,
      },
    });
    if (previous) updated++;
    else imported++;
  }
  await prisma.youtubeVideo.updateMany({
    where: {
      youtubeId: { in: videos.map((video) => video.youtubeId) },
      visibleOnSite: false,
      visibilityCustomized: false,
    },
    data: { visibleOnSite: true },
  });
  return { imported, updated };
}

let refreshAfter = 0;
let refreshInProgress: Promise<void> | undefined;

export async function refreshYoutubeLibrary() {
  if (refreshInProgress) return refreshInProgress;
  if (Date.now() < refreshAfter) return;
  refreshInProgress = (async () => {
    let refreshed = false;
    try {
      refreshed = Boolean(await syncYoutubeLibrary());
    } catch {
      console.warn("[youtube] Não foi possível atualizar o catálogo.");
    } finally {
      refreshAfter = Date.now() + (refreshed ? 30 : 5) * 60_000;
      refreshInProgress = undefined;
    }
  })();
  return refreshInProgress;
}

export async function listPublicYoutubeVideos(limit: number) {
  await refreshYoutubeLibrary();
  return prisma.youtubeVideo.findMany({
    where: { visibleOnSite: true },
    orderBy: [{ publishedAt: "desc" }, { youtubeId: "asc" }],
    take: limit,
    select: {
      id: true, youtubeId: true, title: true, description: true, thumbnailUrl: true,
      publishedAt: true, duration: true, viewCount: true,
    },
  });
}
