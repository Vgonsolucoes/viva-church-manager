import React, { useState } from "react";
import { View, Text, Alert, Linking } from "react-native";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/ScreenContainer";
import { AppHeader } from "@/components/AppHeader";
import { AppCard } from "@/components/AppCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAppTheme } from "@/theme";
import {
  getArrivalStatus,
  isArrivalEnabledHere,
  lastArrivalResult,
  enableArrivalHere,
  disableArrivalHere,
  requestBackgroundArrival,
  confirmArrivalNow,
} from "@/services/arrival";

export default function ArrivalScreen() {
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  const status = useQuery({
    queryKey: ["arrival-status"],
    queryFn: async () => {
      const current = await getArrivalStatus();
      const [deviceEnabled, background, last] = await Promise.all([
        isArrivalEnabledHere(current.memberId),
        Location.getBackgroundPermissionsAsync(),
        lastArrivalResult(),
      ]);
      return {
        ...current,
        deviceEnabled,
        background: background.granted,
        last,
      };
    },
  });
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      Alert.alert(
        "Chegada à igreja",
        error instanceof Error ? error.message : "Tente novamente.",
      );
    } finally {
      await status.refetch();
      setBusy(false);
    }
  };
  const textStyle = {
    color: theme.colors.foregroundMuted,
    fontSize: 14,
    lineHeight: 21,
  };
  const active = !!status.data?.deviceEnabled && !!status.data?.consent;
  const allow = () =>
    Alert.alert(
      "Autorizar confirmação de chegada",
      "Com sua autorização, o app usa a localização, inclusive em segundo plano, para registrar sua chegada e saída na igreja nos horários de culto. A direção vê sua presença. Você pode desativar a qualquer momento. Precisamos de internet para sincronizar.",
      [
        { text: "Agora não", style: "cancel" },
        {
          text: "Ativar",
          onPress: () =>
            void run(async () => {
              await enableArrivalHere();
              Alert.alert(
                "Localização em segundo plano",
                "Na próxima tela, escolha permitir a localização o tempo todo para confirmar a chegada sem manter o app aberto.",
                [
                  { text: "Usar apenas o botão Cheguei", style: "cancel" },
                  {
                    text: "Continuar",
                    onPress: () =>
                      void run(async () => {
                        const granted = await requestBackgroundArrival();
                        if (!granted)
                          Alert.alert(
                            "Permissão necessária",
                            "A chegada automática depende da localização em segundo plano. O botão Cheguei continua disponível.",
                          );
                      }),
                  },
                ],
              );
            }),
        },
      ],
    );
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="Chegada à igreja" showBack />
      <ScreenContainer
        scrollable
        edges={["left", "right", "bottom"]}
        refreshing={status.isFetching}
        onRefresh={() => {
          void status.refetch();
        }}
      >
        <AppCard contentStyle={{ gap: 16 }}>
          <Text
            style={{
              color: theme.colors.foreground,
              fontSize: 22,
              fontWeight: "700",
            }}
          >
            Confirme sua presença no culto
          </Text>
          <Text style={textStyle}>
            {status.data?.config.address ?? "Carregando localização da igreja…"}
          </Text>
          <Text style={textStyle}>
            {active
              ? status.data?.background
                ? "Chegada automática ativada neste celular."
                : "Confirmação manual ativada. Autorize o segundo plano para a detecção automática."
              : "A confirmação por localização está desativada neste celular."}
          </Text>
          <Text style={textStyle}>
            O app verifica sua chegada na área da igreja e nos horários
            configurados. No Android, encerrar o app à força ou restringir a
            bateria pode impedir a detecção. Nesses casos, abra o app e toque em
            Cheguei. Autorize a localização precisa nas permissões do celular.
          </Text>
          {status.error ? (
            <Text style={{ color: theme.colors.danger500 }}>
              Não foi possível carregar. Atualize a tela.
            </Text>
          ) : null}
          {!active ? (
            <PrimaryButton
              title="Autorizar confirmação de chegada"
              onPress={allow}
              loading={busy}
              disabled={!status.data?.config.enabled}
            />
          ) : (
            <>
              <PrimaryButton
                title="Cheguei à igreja"
                loading={busy}
                onPress={() =>
                  void run(async () => {
                    const result = await confirmArrivalNow();
                    if (result) Alert.alert("Chegada à igreja", result.message);
                  })
                }
              />
              {!status.data?.background ? (
                <SecondaryButton
                  title="Ativar localização em segundo plano"
                  onPress={() => {
                    Alert.alert(
                      "Localização em segundo plano",
                      "Autorize a localização o tempo todo para registrar a chegada com o app em segundo plano.",
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Continuar",
                          onPress: () => void run(requestBackgroundArrival),
                        },
                      ],
                    );
                  }}
                />
              ) : null}
              <SecondaryButton
                title="Desativar confirmação de chegada"
                disabled={busy}
                onPress={() => void run(disableArrivalHere)}
              />
            </>
          )}
          <SecondaryButton
            title="Abrir permissões do celular"
            onPress={() => {
              void Linking.openSettings();
            }}
          />
          {status.data?.last ? (
            <Text style={textStyle}>
              Última tentativa ·{" "}
              {new Date(status.data.last.date).toLocaleTimeString("pt-BR")}
              {String.fromCharCode(10)}
              {status.data.last.message}
            </Text>
          ) : null}
        </AppCard>
      </ScreenContainer>
    </View>
  );
}
