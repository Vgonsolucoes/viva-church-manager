export type YoutubeVideoItem = {
  youtubeId: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  publishedAt: Date;
  duration?: string | null;
  viewCount?: number | null;
};

const DEFAULT_MAX_RESULTS = 50;

function getEnvChannelHandle(): string | null {
  const raw = process.env.YOUTUBE_CHANNEL_HANDLE;
  if (!raw) return null;
  return raw.startsWith("@") ? raw : `@${raw}`;
}

function getEnvChannelId(): string | null {
  return process.env.YOUTUBE_CHANNEL_ID || null;
}

function getEnvApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null;
}

export function getYoutubeConfig() {
  return {
    channelHandle: getEnvChannelHandle(),
    channelId: getEnvChannelId(),
    hasApiKey: Boolean(getEnvApiKey()),
    defaultHandle: getEnvChannelHandle() ?? "@viva_sede",
  };
}

async function resolveChannelIdByHandle(apiKey: string, handle: string): Promise<string | null> {
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/channels` +
      `?part=id&id=&forHandle=${encodeURIComponent(cleanHandle)}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: Array<{ id: string }> };
    return data.items?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function resolveChannelId(): Promise<string | null> {
  const envId = getEnvChannelId();
  if (envId) return envId;

  const apiKey = getEnvApiKey();
  const handle = getEnvChannelHandle();
  if (apiKey && handle) {
    const fromHandle = await resolveChannelIdByHandle(apiKey, handle);
    if (fromHandle) return fromHandle;
  }

  return null;
}

async function fetchFromDataApi(
  channelId: string,
  maxResults = DEFAULT_MAX_RESULTS,
): Promise<YoutubeVideoItem[]> {
  const apiKey = getEnvApiKey();
  if (!apiKey) return [];

  const playlistUrl =
    `https://www.googleapis.com/youtube/v3/channels` +
    `?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`;
  const playlistRes = await fetch(playlistUrl, { next: { revalidate: 3600 } });
  if (!playlistRes.ok) return [];
  const playlistData = (await playlistRes.json()) as {
    items?: Array<{
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  };
  const uploadsPlaylistId =
    playlistData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
  if (!uploadsPlaylistId) return [];

  const items: YoutubeVideoItem[] = [];
  let pageToken: string | undefined = undefined;
  let total = 0;

  while (total < maxResults) {
    const qs = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, maxResults - total)),
      key: apiKey,
    });
    if (pageToken) qs.set("pageToken", pageToken);
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?${qs.toString()}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: Array<{
        snippet?: {
          resourceId?: { videoId?: string };
          title?: string;
          description?: string;
          thumbnails?: Record<string, { url?: string }>;
          publishedAt?: string;
        };
        contentDetails?: { duration?: string; videoId?: string };
        status?: { privacyStatus?: string };
      }>;
      nextPageToken?: string;
    };

    const chunk = data.items ?? [];
    for (const entry of chunk) {
      const snippet = entry.snippet ?? {};
      const videoId =
        snippet.resourceId?.videoId ?? entry.contentDetails?.videoId ?? null;
      if (!videoId) continue;
      const thumbs = snippet.thumbnails ?? {};
      const thumbnailUrl =
        thumbs.maxres?.url ?? thumbs.standard?.url ?? thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null;
      const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : new Date();
      items.push({
        youtubeId: videoId,
        title: snippet.title?.trim() ?? "Sem título",
        description: snippet.description ?? null,
        thumbnailUrl,
        publishedAt,
        duration: entry.contentDetails?.duration ?? null,
        viewCount: null,
      });
    }
    total += chunk.length;
    if (!data.nextPageToken || chunk.length === 0) break;
    pageToken = data.nextPageToken;
  }

  return items;
}

function getText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map((n) => getText(n)).join("");
  if (typeof node === "object" && "_" in (node as Record<string, unknown>)) {
    return getText((node as Record<string, unknown>)["_"]);
  }
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return getText((node as Record<string, unknown>)["#text"]);
  }
  return String(node);
}

function getAttr(node: unknown, attr: string): string | null {
  if (!node || typeof node !== "object") return null;
  const key = `$${attr}`;
  if (key in (node as Record<string, unknown>)) {
    const v = (node as Record<string, unknown>)[key];
    return typeof v === "string" ? v : null;
  }
  if ("$" in (node as Record<string, unknown>)) {
    const attrs = (node as Record<string, unknown>)["$"];
    if (attrs && typeof attrs === "object" && attr in (attrs as Record<string, unknown>)) {
      const v = (attrs as Record<string, unknown>)[attr];
      return typeof v === "string" ? v : null;
    }
  }
  return null;
}

async function parseRssXml(xml: string): Promise<YoutubeVideoItem[]> {
  try {
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "$",
      allowBooleanAttributes: true,
    });
    const parsed = parser.parse(xml) as {
      feed?: { entry?: unknown | unknown[] };
    };
    const entries = parsed.feed?.entry ?? [];
    const list = Array.isArray(entries) ? entries : [entries];
    const result: YoutubeVideoItem[] = [];
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const ytVideoId =
        getAttr((entry["yt:videoId"] ?? entry["videoId"]), "") ||
        getText(entry["yt:videoId"] ?? entry["videoId"]);
      if (!ytVideoId) continue;
      const title = getText(entry["title"]).trim() || "Sem título";
      const publishedAt = new Date(getText(entry["published"]) || Date.now());
      let thumbnail = getAttr(entry["media:thumbnail"] ?? entry["thumbnail"], "url");
      if (!thumbnail) {
        thumbnail = `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`;
      }
      const group = entry["media:group"] ?? entry["group"];
      let description: string | null = null;
      if (group && typeof group === "object") {
        description =
          getText((group as Record<string, unknown>)["media:description"]) ||
          getText((group as Record<string, unknown>)["description"]) ||
          null;
      }
      if (!description) description = getText(entry["summary"] ?? entry["content"]) || null;
      result.push({
        youtubeId: ytVideoId,
        title,
        description,
        thumbnailUrl: thumbnail,
        publishedAt,
        duration: null,
        viewCount: null,
      });
    }
    return result;
  } catch (err) {
    console.error("[youtube] Erro ao fazer parse do RSS:", err);
    return [];
  }
}

async function fetchFromRssFeed(
  channelId: string,
  maxResults = DEFAULT_MAX_RESULTS,
): Promise<YoutubeVideoItem[]> {
  if (!channelId) return [];
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = await parseRssXml(xml);
    return parsed.slice(0, maxResults);
  } catch {
    return [];
  }
}

export async function fetchChannelVideos(
  options?: { maxResults?: number },
): Promise<YoutubeVideoItem[]> {
  const max = options?.maxResults ?? DEFAULT_MAX_RESULTS;
  const channelId = await resolveChannelId();
  if (!channelId) return [];

  if (getEnvApiKey()) {
    const fromApi = await fetchFromDataApi(channelId, max);
    if (fromApi.length) return fromApi;
  }
  return fetchFromRssFeed(channelId, max);
}

export function getYoutubeEmbedUrl(youtubeId: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}`;
}

export function getYoutubeWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
}
