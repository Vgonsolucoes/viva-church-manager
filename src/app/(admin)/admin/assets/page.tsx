import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { authOptions } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  category: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  condition: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "LOANED", "MAINTENANCE", "DISPOSED"]).default("ACTIVE"),
});

async function createAsset(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  const parsed = createSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    category: formData.get("category"),
    location: formData.get("location"),
    condition: formData.get("condition"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const code = parsed.data.code.trim().toUpperCase();
  const asset = await prisma.asset.create({
    data: {
      code,
      name: parsed.data.name.trim(),
      category: parsed.data.category ? parsed.data.category.trim() : null,
      location: parsed.data.location ? parsed.data.location.trim() : null,
      condition: parsed.data.condition ? parsed.data.condition.trim() : null,
      status: parsed.data.status,
      qrCode: `asset:${code}`,
    },
  });

  await logAudit({
    actorUserId: session?.uid ?? null,
    action: "CREATE",
    entityType: "Asset",
    entityId: asset.id,
    after: { id: asset.id, code: asset.code, name: asset.name, status: asset.status },
  });

  revalidatePath("/admin/assets");
}

export default async function AssetsPage() {
  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Patrimônio</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Cadastro de itens, status e QR Code para rastreio.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Itens cadastrados</div>
            <div className="text-xs text-muted-foreground">{assets.length} exibidos</div>
          </div>
          <div className="mt-4 divide-y divide-border">
            {assets.length ? (
              assets.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {a.name} <span className="text-muted-foreground">•</span>{" "}
                      <span className="font-mono text-xs">{a.code}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {a.category ?? "Sem categoria"}
                      {a.location ? ` • ${a.location}` : ""}
                      {a.condition ? ` • ${a.condition}` : ""}
                    </div>
                    <div className="mt-2 text-xs">
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={`/api/assets/${a.id}/qr`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir QR Code
                      </a>
                    </div>
                  </div>
                  <Badge className="shrink-0">{a.status}</Badge>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-muted-foreground">
                Nenhum item cadastrado ainda.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-medium">Novo item</div>
          <form action={createAsset} className="mt-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Código</div>
              <Input name="code" placeholder="Ex: VC-0001" required />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Nome</div>
              <Input name="name" placeholder="Ex: Mesa de som" required />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Categoria</div>
              <Input name="category" placeholder="Ex: Áudio" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Localização</div>
              <Input name="location" placeholder="Ex: Sala técnica" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Conservação</div>
              <Input name="condition" placeholder="Ex: Bom" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Status</div>
              <select
                name="status"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                defaultValue="ACTIVE"
              >
                <option value="ACTIVE">Ativo</option>
                <option value="LOANED">Emprestado</option>
                <option value="MAINTENANCE">Manutenção</option>
                <option value="DISPOSED">Baixado</option>
              </select>
            </div>
            <Button className="w-full" type="submit">
              Cadastrar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

