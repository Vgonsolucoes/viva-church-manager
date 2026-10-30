import React, { useState } from "react";
import { Text, TextInput, View, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { ScreenContainer } from "@/components/ScreenContainer";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/theme";
import { getProjectionRequests, sendProjectionRequest, type ProjectionChannel } from "@/services/api/projection";

export default function ProjectionNotices() {
  const params = useLocalSearchParams<{ channel?: string }>();
  const channel: ProjectionChannel = params.channel === "PARKING" ? "PARKING" : "KIDS";
  const { me, initialized, refreshMe } = useAuth();
  const allowed = Boolean(me?.projectionAccess?.[channel]);
  const client = useQueryClient();
  const [childId, setChildId] = useState("");
  const [search, setSearch] = useState("");
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [color, setColor] = useState("");
  const [location, setLocation] = useState("Estacionamento da igreja");
  const [message, setMessage] = useState(channel === "KIDS" ? "Solicitamos que o responsável compareça ao Kids." : "Solicitamos que o proprietário compareça ao estacionamento.");
  const queryKey = ["projection-requests", me?.id, channel];
  const query = useQuery({ queryKey, queryFn: () => getProjectionRequests(channel), enabled: initialized && allowed, refetchInterval: 10000 });
  const mutation = useMutation({
    mutationFn: () => sendProjectionRequest(channel === "KIDS" ? { channel, childId, message } : { channel, plate, vehicle, color, location, message }),
    onSuccess: () => { Alert.alert("Enviado", "Aviso recebido pela equipe de projeção."); setChildId(""); setPlate(""); setVehicle(""); setColor(""); void client.invalidateQueries({ queryKey }); },
    onError: error => Alert.alert("Não foi possível enviar", error instanceof Error ? error.message : "Tente novamente."),
  });
  const label = channel === "KIDS" ? "Avisos Kids" : "Estacionamento";
  return <View style={styles.screen}>
    <AppHeader title={label} subtitle="Chamados para a projeção" showBack />
    <ScreenContainer scrollable refreshing={query.isFetching} onRefresh={async () => { await refreshMe(true); if (allowed) await query.refetch(); }}>
      {!allowed ? <Text style={styles.text}>Acesso exclusivo aos integrantes do respectivo ministério ativo. Atualize a tela após a liderança vincular seu cadastro.</Text> : query.isError ? <View style={styles.section}><Text style={styles.text}>Não foi possível carregar os avisos. Verifique sua conexão e seu vínculo com o ministério.</Text><PrimaryButton title="Tentar novamente" onPress={() => void query.refetch()} /></View> : <>
        <View style={styles.section}>
          <Text style={styles.heading}>{channel === "KIDS" ? "Chamar responsável" : "Chamar proprietário"}</Text>
          {channel === "KIDS" ? <>
            <Text style={styles.text}>Selecione uma criança com check-in ativo</Text>
            <TextInput accessibilityLabel="Buscar criança" placeholder="Buscar criança" placeholderTextColor="#94a3b8" value={search} onChangeText={setSearch} style={styles.input} />
            {(query.data?.children ?? []).filter(child => child.fullName.toLowerCase().includes(search.toLowerCase())).map(child => <Pressable accessibilityRole="radio" accessibilityState={{ checked: childId === child.id }} key={child.id} onPress={() => setChildId(child.id)} style={[styles.option, childId === child.id && styles.selected]}><Text style={styles.text}>{childId === child.id ? "✓ " : ""}{child.fullName}</Text></Pressable>)}
            {!query.data?.children.length ? <Text style={styles.text}>{query.isLoading ? "Carregando crianças…" : "Nenhuma criança com check-in ativo neste culto."}</Text> : null}
          </> : <>
            <Text style={styles.text}>Placa</Text><TextInput accessibilityLabel="Placa" placeholder="ABC1D23" placeholderTextColor="#94a3b8" autoCapitalize="characters" maxLength={9} value={plate} onChangeText={setPlate} style={styles.input} />
            <Text style={styles.text}>Modelo do veículo (opcional)</Text><TextInput accessibilityLabel="Modelo do veículo" value={vehicle} onChangeText={setVehicle} maxLength={80} style={styles.input} />
            <Text style={styles.text}>Cor (opcional)</Text><TextInput accessibilityLabel="Cor do veículo" value={color} onChangeText={setColor} maxLength={30} style={styles.input} />
            <Text style={styles.text}>Local para comparecer</Text><TextInput accessibilityLabel="Local para comparecer" value={location} onChangeText={setLocation} maxLength={80} style={styles.input} />
          </>}
          <Text style={styles.text}>Mensagem</Text><TextInput accessibilityLabel="Mensagem para projeção" value={message} onChangeText={setMessage} multiline maxLength={240} style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]} />
          <PrimaryButton title="Enviar para projeção" loading={mutation.isPending} disabled={query.isLoading || message.trim().length < 3 || (channel === "KIDS" ? !childId : !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate.toUpperCase().replace(/[\s-]/g, "")) || location.trim().length < 3)} onPress={() => mutation.mutate()} />
        </View>
        <View style={styles.section}><Text style={styles.heading}>Histórico de avisos</Text>{query.data?.history.map(item => <View key={item.id} style={styles.option}><Text style={styles.heading}>{item.subject}</Text><Text style={styles.text}>{item.message}</Text><Text style={styles.text}>{item.status === "PENDING" ? "Aguardando projeção" : "Visualizado"} · {new Date(item.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text></View>)}{!query.data?.history.length ? <Text style={styles.text}>Nenhum aviso enviado.</Text> : null}</View>
      </>}
    </ScreenContainer>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  section: { padding: 16, gap: 12, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 20, marginBottom: 16 },
  text: { color: theme.colors.foreground, fontSize: 14 },
  heading: { color: theme.colors.foreground, fontSize: 16, fontWeight: "700" },
  input: { color: theme.colors.foreground, backgroundColor: theme.colors.backgroundSecondary, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12, padding: 12, fontSize: 16 },
  option: { padding: 12, gap: 6, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 12 },
  selected: { borderColor: theme.colors.primary500, backgroundColor: "rgba(23,107,255,0.12)" },
});
