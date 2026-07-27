"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type MemberTypeValue = "MEMBER" | "VISITOR" | "NEW_MEMBER" | "LEADER" | "VOLUNTEER" | "DISCIPLER";

const memberTypeOptions: Array<{ value: MemberTypeValue; label: string }> = [
  { value: "MEMBER", label: "Membro" },
  { value: "VISITOR", label: "Visitante" },
  { value: "NEW_MEMBER", label: "Novo membro" },
  { value: "LEADER", label: "Líder" },
  { value: "VOLUNTEER", label: "Voluntário" },
  { value: "DISCIPLER", label: "Discipulador" },
];

function normalizeCep(input: string) {
  return input.replace(/\D/g, "").slice(0, 8);
}

function formatCpf(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

async function fetchViaCep(cep: string) {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: "no-store" });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (!data || typeof data !== "object") return null;
  if ("erro" in data) return null;
  return data as {
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
}

export function MembersFormClient(props: {
  mode: "create" | "edit";
  title: string;
  submitLabel: string;
  action: (formData: FormData) => void;
  ministries: Array<{ id: string; name: string }>;
  defaultValues?: Partial<{
    memberId: string;
    fullName: string;
    cpf: string | null;
    email: string | null;
    phone: string | null;
    ministryIds: string[] | null;
    zip: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    baptized: boolean;
    baptismYear: number | null;
    conversionYear: number | null;
    types: MemberTypeValue[] | null;
  }>;
}) {
  const initialTypes = useMemo(() => {
    const types = props.defaultValues?.types ?? ["MEMBER"];
    return new Set<MemberTypeValue>(types.length ? types : ["MEMBER"]);
  }, [props.defaultValues?.types]);

  const initialMinistries = useMemo(() => {
    const ids = props.defaultValues?.ministryIds ?? [];
    return new Set<string>(ids);
  }, [props.defaultValues?.ministryIds]);

  const [selectedTypes, setSelectedTypes] = useState<Set<MemberTypeValue>>(initialTypes);
  const [selectedMinistryIds, setSelectedMinistryIds] = useState<Set<string>>(initialMinistries);
  const [cpf, setCpf] = useState(props.defaultValues?.cpf ? formatCpf(props.defaultValues.cpf) : "");
  const [zip, setZip] = useState(props.defaultValues?.zip ?? "");
  const [addressLine1, setAddressLine1] = useState(props.defaultValues?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(props.defaultValues?.addressLine2 ?? "");
  const [neighborhood, setNeighborhood] = useState(props.defaultValues?.neighborhood ?? "");
  const [city, setCity] = useState(props.defaultValues?.city ?? "");
  const [state, setState] = useState(props.defaultValues?.state ?? "");
  const [baptized, setBaptized] = useState(Boolean(props.defaultValues?.baptized));
  const [baptismYear, setBaptismYear] = useState(
    props.defaultValues?.baptismYear ? String(props.defaultValues.baptismYear) : "",
  );
  const [conversionYear, setConversionYear] = useState(
    props.defaultValues?.conversionYear ? String(props.defaultValues.conversionYear) : "",
  );
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");

  function toggleType(value: MemberTypeValue) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      if (!next.size) next.add("MEMBER");
      return next;
    });
  }

  function toggleMinistry(id: string) {
    setSelectedMinistryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCepBlur() {
    const cep = normalizeCep(zip);
    if (cep.length !== 8) return;
    setCepStatus("loading");
    const data = await fetchViaCep(cep);
    if (!data) {
      setCepStatus("error");
      return;
    }
    setCepStatus("ok");
    if (data.logradouro) setAddressLine1(data.logradouro);
    if (data.bairro) setNeighborhood(data.bairro);
    if (data.localidade) setCity(data.localidade);
    if (data.uf) setState(data.uf);
  }

  return (
    <div>
      <div className="text-sm font-medium">{props.title}</div>
      <form action={props.action} className="mt-4 space-y-3">
        {props.mode === "edit" ? (
          <input type="hidden" name="memberId" value={props.defaultValues?.memberId ?? ""} />
        ) : null}

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Nome completo</div>
          <Input
            name="fullName"
            placeholder="Nome do membro"
            required
            defaultValue={props.defaultValues?.fullName ?? ""}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">CPF</div>
            <Input
              name="cpf"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">E-mail</div>
            <Input
              name="email"
              type="email"
              placeholder="email@exemplo.com"
              defaultValue={props.defaultValues?.email ?? ""}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Telefone</div>
            <Input
              name="phone"
              placeholder="(00) 00000-0000"
              defaultValue={props.defaultValues?.phone ?? ""}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Ministérios</div>
          <div className="rounded-2xl border border-border bg-background p-3">
            <div className="grid grid-cols-1 gap-2">
              {props.ministries.map((ministry) => (
                <label key={ministry.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="ministryIds"
                    value={ministry.id}
                    className="size-4"
                    checked={selectedMinistryIds.has(ministry.id)}
                    onChange={() => toggleMinistry(ministry.id)}
                  />
                  <span>{ministry.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Você pode escolher mais de um ministério.</div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Tipos do cadastro</div>
          <div className="rounded-2xl border border-border bg-background p-3">
            <div className="grid grid-cols-1 gap-2">
              {memberTypeOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="types"
                    value={option.value}
                    className="size-4"
                    checked={selectedTypes.has(option.value)}
                    onChange={() => toggleType(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Você pode marcar mais de um tipo para a mesma pessoa.
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="baptized"
              className="size-4"
              checked={baptized}
              onChange={(e) => {
                const checked = e.target.checked;
                setBaptized(checked);
                if (!checked) setBaptismYear("");
              }}
            />
            <span>É batizado?</span>
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Ano do batismo</div>
              <Input
                name="baptismYear"
                inputMode="numeric"
                placeholder="Ex: 2020"
                value={baptismYear}
                onChange={(e) => setBaptismYear(e.target.value)}
                disabled={!baptized}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Ano de conversão</div>
              <Input
                name="conversionYear"
                inputMode="numeric"
                placeholder="Ex: 2018"
                value={conversionYear}
                onChange={(e) => setConversionYear(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Endereço (via CEP)</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">CEP</div>
              <Input
                name="zip"
                placeholder="00000-000"
                value={zip}
                onChange={(e) => setZip(normalizeCep(e.target.value))}
                onBlur={handleCepBlur}
              />
              {cepStatus === "error" ? (
                <div className="text-xs text-red-400">CEP inválido ou não encontrado.</div>
              ) : null}
              {cepStatus === "loading" ? (
                <div className="text-xs text-muted-foreground">Buscando endereço…</div>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Estado (UF)</div>
              <Input
                name="state"
                placeholder="Ex: SP"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Cidade</div>
              <Input name="city" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Bairro</div>
              <Input
                name="neighborhood"
                placeholder="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Logradouro</div>
            <Input
              name="addressLine1"
              placeholder="Rua / Avenida"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Complemento / Número</div>
            <Input
              name="addressLine2"
              placeholder="Apto, bloco, número"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </div>
        </div>

        <Button className="w-full" type="submit">
          {props.submitLabel}
        </Button>
      </form>
    </div>
  );
}
