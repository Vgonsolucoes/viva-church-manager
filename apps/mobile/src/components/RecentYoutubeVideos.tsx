import { FlatList, Image, Linking, Pressable, Text, View } from "react-native";
import { Play } from "lucide-react-native";
import { useAppTheme } from "@/theme";
import { SectionHeader } from "@/components/SectionHeader";
import type { RecentVideos } from "@/services/api/videos";

function openYoutube(url: string) {
  void Linking.openURL(url).catch(() => {});
}

export function RecentYoutubeVideos({ data, loading }: { data?: RecentVideos; loading?: boolean }) {
  const theme = useAppTheme();
  const videos = data?.videos ?? [];

  return (
    <View style={{ gap: 12 }}>
      <SectionHeader
        title="Vídeos recentes"
        actionLabel="Ver canal"
        onActionPress={() => openYoutube(data?.channelUrl ?? "https://www.youtube.com/@viva_sede/videos")}
      />
      {loading ? (
        <Text style={{ color: theme.colors.foregroundMuted }}>Carregando vídeos…</Text>
      ) : videos.length ? (
        <FlatList
          data={videos}
          horizontal
          keyExtractor={(video) => video.youtubeId}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 8 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Assistir ${item.title} no YouTube`}
              onPress={() => openYoutube(`https://www.youtube.com/watch?v=${encodeURIComponent(item.youtubeId)}`)}
              style={{ width: 244, overflow: "hidden", borderRadius: 16, backgroundColor: theme.colors.card }}
            >
              <View style={{ aspectRatio: 16 / 9, backgroundColor: theme.colors.backgroundSecondary, alignItems: "center", justifyContent: "center" }}>
                {item.thumbnailUrl && <Image source={{ uri: item.thumbnailUrl }} resizeMode="cover" style={{ position: "absolute", width: "100%", height: "100%" }} />}
                <View style={{ backgroundColor: "#0009", borderRadius: 20, padding: 8 }}>
                  <Play size={20} color="#fff" fill="#fff" />
                </View>
              </View>
              <Text numberOfLines={2} style={{ padding: 12, fontSize: 14, fontWeight: "600", color: theme.colors.foreground }}>{item.title}</Text>
            </Pressable>
          )}
        />
      ) : (
        <Text style={{ color: theme.colors.foregroundMuted }}>Acesse o canal Viva Sede para assistir aos vídeos.</Text>
      )}
    </View>
  );
}
