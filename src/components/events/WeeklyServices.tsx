import Image from "next/image";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/server/auth";
import { hasPermission } from "@/server/rbac";
import { getWeeklyServices, updateWeeklyService } from "@/server/weekly-services";
import { WEEKLY_SERVICES } from "@/lib/weekly-services";
import { savePublicImageUpload } from "@/server/uploads";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { z } from "zod";

async function saveArtwork(form: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.uid || !hasPermission(session.roles ?? [], "events:write")) throw new Error("Sem permissão para editar cultos.");
  const key = z.enum(["sunday", "wednesday"]).parse(form.get("key"));
  const name = z.string().trim().min(2).max(150).parse(form.get("name"));
  const location = z.string().trim().max(200).parse(form.get("location") ?? "");
  const url = z.string().trim().refine(value => !value || /^https?:\/\//i.test(value), "Use uma URL de imagem http ou https.").parse(form.get("imageUrl") ?? "");
  const file = form.get("artwork");
  const uploaded = file instanceof File && file.size ? await savePublicImageUpload(file) : null;
  if (file instanceof File && file.size && !uploaded) throw new Error("Não foi possível salvar a arte. Use PNG, JPG ou WebP de até 5 MB.");
  const current = (await getWeeklyServices()).find(service => service.key === key)!;
  const bannerImageUrl = uploaded ?? (form.get("removeArtwork") === "on" ? null : url || current.bannerImageUrl);
  await updateWeeklyService({ key, name, location: location || null, bannerImageUrl });
  revalidatePath("/admin/cultos-fixos"); revalidatePath("/admin/calendar"); revalidatePath("/app/calendar");
}
export async function WeeklyServices() {
  const session = await getServerSession(authOptions);
  const canWrite = hasPermission(session?.roles ?? [], "events:write");
  const services = await getWeeklyServices();
  return <section className="space-y-4">
    <div><h1 className="text-xl font-semibold">Cultos Fixos</h1><p className="mt-1 text-sm text-muted-foreground">Horários semanais e artes dos próximos cultos · horário de Brasília · disponíveis no aplicativo.</p></div>
    <div className="grid gap-4 md:grid-cols-2">{services.map(service => <Card key={service.key} className="overflow-hidden">
      {service.bannerImageUrl && <div className="relative aspect-video bg-muted"><Image src={service.bannerImageUrl} alt={`Arte de ${service.name}`} fill className="object-contain" unoptimized /></div>}
      <div className="space-y-3 p-5"><h3 className="font-semibold">{service.name}</h3><p className="text-sm text-primary">{WEEKLY_SERVICES.find(item => item.key === service.key)!.label}</p>
      {canWrite && <form action={saveArtwork} className="space-y-3">
        <input type="hidden" name="key" value={service.key}/>
        <label className="block space-y-1 text-sm">Nome do culto<Input name="name" defaultValue={service.name} required maxLength={150}/></label>
        <label className="block space-y-1 text-sm">Local<Input name="location" defaultValue={service.location ?? ""} maxLength={200}/></label>
        <label className="block space-y-1 text-sm">Arte do culto<input name="artwork" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full rounded-xl border border-border p-2 text-sm"/></label>
        <label className="block space-y-1 text-sm">Ou URL da imagem<Input name="imageUrl" type="url" placeholder="https://…"/></label>
        <p className="text-xs text-muted-foreground">PNG, JPG ou WebP · até 5 MB. {service.key === "sunday" ? "A mesma arte será usada nos cultos de domingo às 09h e às 18h." : "A arte vale para as próximas datas deste culto."}</p>
        {service.bannerImageUrl && <label className="flex items-center gap-2 text-sm"><input name="removeArtwork" type="checkbox"/>Remover arte atual</label>}
        <Button type="submit">Salvar culto fixo</Button>
      </form>}
      </div></Card>)}</div>
  </section>;
}
