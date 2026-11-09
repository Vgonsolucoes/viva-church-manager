import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { z } from "zod";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api/client";
import { useSessionStore } from "@/stores/session";
import { useAppTheme } from "@/theme";
import { formatCurrencyBRL } from "@/utils/date";

const ticketsSchema = z.array(z.object({
  id: z.string(), number: z.number().int(), paid: z.boolean(), title: z.string(),
  prize: z.string(), priceCents: z.number().int(), closed: z.boolean(), won: z.boolean(),
}));

export default function MyRafflesScreen() {
  const theme = useAppTheme();
  const me = useSessionStore((state) => state.me);
  const allowed = me?.access?.mobileModules.includes("raffles") === true;
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["my-raffle-tickets", me?.id],
    queryFn: async () => ticketsSchema.parse(await api.get<unknown>("/api/v1/raffles/my")),
    enabled: allowed,
  });

  return (
    <Screen title="Meus números" loading={isLoading} refreshing={isFetching && !isLoading} onRefresh={allowed ? () => void refetch() : undefined}>
      {!allowed ? (
        <EmptyState title="Acesso não disponível" description="Consulte a equipe da igreja para liberar Sorteio no seu cadastro." />
      ) : isError ? (
        <EmptyState title="Não foi possível carregar seus números" actionLabel="Tentar novamente" onAction={() => void refetch()} />
      ) : !isLoading && !data?.length ? (
        <EmptyState title="Você ainda não tem números" description="Os números vinculados ao seu cadastro aparecem aqui." />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {data?.map((ticket) => (
            <Card key={ticket.id} elevated>
              <View style={{ gap: theme.spacing.xs }}>
                <Text style={{ color: theme.colors.foreground, fontSize: 17, fontWeight: "700" }}>{ticket.title}</Text>
                <Text style={{ color: theme.colors.foregroundMuted }}>{ticket.prize}</Text>
                <Text style={{ color: theme.colors.foreground, fontSize: 24, fontWeight: "700" }}>Nº {ticket.number}</Text>
                <Text style={{ color: ticket.paid ? theme.colors.success500 : theme.colors.foregroundMuted }}>
                  {formatCurrencyBRL(ticket.priceCents)} · {ticket.paid ? "Pago" : "Pagamento pendente"}
                </Text>
                {ticket.closed && <Text style={{ color: theme.colors.foreground }}>{ticket.won ? "Número contemplado" : "Sorteio encerrado"}</Text>}
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
