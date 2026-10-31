"use client";
import { useState } from "react";
import { ShieldCheck, Monitor, Smartphone } from "lucide-react";
import { WEB_MODULES, MOBILE_MODULES, MEMBER_TYPES, defaultProfile, defaultMinistryProfile, defaultRoleProfile, type AccessConfig, type AccessProfile } from "@/lib/access-control";
import { rolePermissions, type RoleKey } from "@/server/rbac";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { saveAccessProfile } from "./actions";

type Props = { initialConfig: AccessConfig; ministries: { id: string; name: string; active: boolean }[] };
const ROLE_LABELS: Record<string, string> = { PASTOR_PRESIDENTE: "Pastor presidente", PASTOR: "Pastor", MINISTRY_LEADER: "Líder de ministério", CELL_LEADER: "Líder de célula", FINANCE: "Financeiro", SECRETARY: "Secretaria", RECEPTION: "Recepção", KIDS_MINISTRY: "Equipe Kids", PARKING: "Estacionamento", PROJECTION: "Operador de projeção", VOLUNTEER: "Voluntário", MEMBER: "Membro" };
export function AccessEditor({ initialConfig, ministries }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [group, setGroup] = useState<"types" | "ministries" | "roles">("types");
  const [key, setKey] = useState("MEMBER");
  const [profile, setProfile] = useState<AccessProfile>(config.types.MEMBER ?? defaultProfile());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const choices = group === "types" ? Object.entries(MEMBER_TYPES).map(([id, name]) => ({ id, name })) : group === "ministries" ? ministries.map(m => ({ id: m.id, name: `${m.name}${m.active ? "" : " (inativo)"}` })) : Object.keys(rolePermissions).filter(r => r !== "SUPER_ADMIN").map(id => ({ id, name: ROLE_LABELS[id] ?? id }));
  function select(nextGroup: typeof group, nextKey: string) {
    if (dirty && !window.confirm("Descartar as alterações ainda não salvas deste perfil?")) return;
    setGroup(nextGroup); setKey(nextKey); setMessage(""); setDirty(false);
    setProfile(config[nextGroup][nextKey] ?? (nextGroup === "ministries" ? defaultMinistryProfile(ministries.find(m => m.id === nextKey)?.name ?? "") : nextGroup === "roles" ? defaultRoleProfile(nextKey as RoleKey) : defaultProfile()));
  }
  function change(next: AccessProfile) { setProfile(next); setDirty(true); setMessage(""); }
  async function save() {
    setPending(true);
    try { const result = await saveAccessProfile(group, key, profile); setMessage(result.message); if (result.ok) { setConfig(c => ({ ...c, [group]: { ...c[group], [key]: profile } })); setDirty(false); } }
    catch { setMessage("Não foi possível salvar. Tente novamente."); }
    finally { setPending(false); }
  }
  return <div className="space-y-6">
    <div className="flex items-start gap-3"><ShieldCheck className="mt-1 size-7 text-primary" /><div><h1 className="text-xl font-semibold">Controle de acessos de usuário</h1><p className="mt-1 text-sm text-muted-foreground">Defina o acesso por tipo de cadastro, ministério e perfil de responsabilidade.</p></div></div>
    <Card className="space-y-3 p-5"><p className="text-sm"><strong>Super Administrador:</strong> acesso total, sempre preservado. Somente ele pode editar estas regras.</p><p className="text-sm text-muted-foreground">As permissões dos ministérios ativos são somadas às do tipo de cadastro. Visitante e Novo Membro usam apenas a regra do próprio tipo. O Infantil do APK permite cuidar dos próprios filhos; a gestão de todas as crianças pertence ao módulo web. Projetar avisos continua exigindo vínculo com o ministério Kids ou Estacionamento.</p><p className="text-sm text-muted-foreground">Cultos Fixos e Eventos compartilham as operações de cadastro, mas a entrada de cada menu pode ser liberada separadamente.</p></Card>
    <Card className="grid gap-4 p-5 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Configurar por<select disabled={pending} className="block h-11 w-full rounded-xl border border-border bg-background px-3" value={group} onChange={e => { const g = e.target.value as typeof group; select(g, g === "types" ? "MEMBER" : g === "ministries" ? ministries[0]?.id ?? "" : "PASTOR"); }}><option value="types">Tipo de cadastro</option><option value="ministries">Ministério</option><option value="roles">Perfil de responsabilidade</option></select></label><label className="space-y-2 text-sm font-medium">Cadastro<select disabled={pending || !choices.length} className="block h-11 w-full rounded-xl border border-border bg-background px-3" value={key} onChange={e => select(group, e.target.value)}>{choices.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></Card>
    {key ? <><div className="grid gap-5 xl:grid-cols-2"><Card className="p-5"><h2 className="flex items-center gap-2 font-semibold"><Monitor className="size-5" /> Acessos na web</h2><label className="my-4 flex items-center gap-3 rounded-xl bg-muted/20 p-3 text-sm"><input type="checkbox" checked={profile.webEnabled} onChange={e => change({ ...profile, webEnabled: e.target.checked })} />Permitir acesso à web</label><div className="divide-y divide-border">{WEB_MODULES.map(m => <label key={m.key} className="flex items-center justify-between gap-4 py-2 text-sm"><span>{m.label}</span><select aria-label={`Web: ${m.label}`} disabled={!profile.webEnabled} value={profile.web[m.key] ?? "none"} className="rounded-lg border border-border bg-background px-2 py-2" onChange={e => { const web = { ...profile.web }; if (e.target.value === "none") delete web[m.key]; else web[m.key] = e.target.value as "read" | "write"; change({ ...profile, web }); }}><option value="none">Sem acesso</option><option value="read">Consultar</option>{m.write.length ? <option value="write">Consultar e alterar</option> : null}</select></label>)}</div></Card><Card className="p-5"><h2 className="flex items-center gap-2 font-semibold"><Smartphone className="size-5" /> Acessos no APK</h2><p className="my-4 text-sm text-muted-foreground">Selecione as telas disponíveis. Sem Escalas, o terceiro ícone será Infantil quando esse módulo estiver liberado.</p><div className="space-y-3">{MOBILE_MODULES.map(m => <label key={m.key} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={profile.mobile.includes(m.key)} onChange={e => change({ ...profile, mobile: e.target.checked ? [...profile.mobile, m.key] : profile.mobile.filter(key => key !== m.key) })} />{m.label}</label>)}</div><label className="mt-6 block space-y-2 text-sm font-medium">Agenda do APK<select className="block h-11 w-full rounded-xl border border-border bg-background px-3" value={profile.agendaScope} onChange={e => change({ ...profile, agendaScope: e.target.value as "own" | "all" })}><option value="own">Somente agenda pessoal e eventos públicos da igreja</option><option value="all">Agenda geral da igreja</option></select></label><p className="mt-2 text-xs text-muted-foreground">A agenda pessoal mostra suas escalas, suas células e seus encontros de discipulado. A agenda geral também inclui escalas e células de outras pessoas.</p></Card></div><div className="sticky bottom-3 rounded-2xl border border-border bg-card p-4 shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="max-w-3xl text-sm">{message || (dirty ? "Há alterações ainda não salvas." : "Regras carregadas.")}</p><Button disabled={pending || !dirty} onClick={save}>{pending ? "Salvando..." : "Salvar acessos"}</Button></div></div></> : <Card className="p-5 text-sm">Cadastre um ministério para configurar seus acessos.</Card>}
  </div>;
}
