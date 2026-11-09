import { getYoutubeConfig } from "@/server/youtube";
import { listPublicYoutubeVideos } from "@/server/youtube-library";

export const dynamic = "force-dynamic";

export async function GET() {
  const videos = await listPublicYoutubeVideos(6);
  return Response.json({
    channelUrl: `https://www.youtube.com/${getYoutubeConfig().defaultHandle}/videos`,
    videos: videos.map(({ youtubeId, title, thumbnailUrl, publishedAt }) => ({
      youtubeId, title, thumbnailUrl, publishedAt,
    })),
  });
}
