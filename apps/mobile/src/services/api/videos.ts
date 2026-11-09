import { z } from "zod";
import { api } from "@/services/api/client";

const videosSchema = z.object({
  channelUrl: z.string().url(),
  videos: z.array(z.object({
    youtubeId: z.string(),
    title: z.string(),
    thumbnailUrl: z.string().nullable(),
    publishedAt: z.string(),
  })),
});

export type RecentVideos = z.infer<typeof videosSchema>;

export async function listRecentVideos() {
  return videosSchema.parse(await api.get<unknown>("/api/public/videos", { skipAuth: true }));
}
