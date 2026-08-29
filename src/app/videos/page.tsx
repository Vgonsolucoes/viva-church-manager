import { prisma } from "@/server/db";
import { getYoutubeConfig } from "@/server/youtube";
import { VideosPublicClient, type PublicYoutubeVideo } from "./VideosPublicClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cultos e Mensagens | Viva Church",
  description:
    "Assista os ultimos cultos, mensagens e conteudos do Ministerio Viva Church no YouTube.",
};

export default async function PublicVideosPage() {
  const videos = await prisma.youtubeVideo.findMany({
    where: { visibleOnSite: true },
    orderBy: { publishedAt: "desc" },
    take: 200,
  });

  const cfg = getYoutubeConfig();

  const mapped: PublicYoutubeVideo[] = videos.map((v) => ({
    id: v.id,
    youtubeId: v.youtubeId,
    title: v.title,
    description: v.description,
    thumbnailUrl: v.thumbnailUrl,
    publishedAt: v.publishedAt.toISOString(),
    duration: v.duration,
    viewCount: v.viewCount ?? null,
  }));

  return (
    <VideosPublicClient videos={mapped} channelHandle={cfg.defaultHandle} />
  );
}
