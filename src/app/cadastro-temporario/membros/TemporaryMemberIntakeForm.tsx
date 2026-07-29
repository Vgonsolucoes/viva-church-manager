"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type MemberTypeValue = "MEMBER" | "VISITOR" | "NEW_MEMBER" | "LEADER" | "VOLUNTEER" | "DISCIPLER";

const memberTypeOptions: Array<{ value: MemberTypeValue; label: string }> = [
  { value: "MEMBER", label: "Membro" },
  { value: "VISITOR", label: "Visitante" },
  { value: "NEW_MEMBER", label: "Novo membro" },
  { value: "LEADER", label: "Lider" },
  { value: "VOLUNTEER", label: "Voluntario" },
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

function validateCpf(digits: string) {
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (length: number, factor: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (factor - i);
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calc(9, 10);
  const d2 = calc(10, 11);
  return Number(digits[9]) === d1 && Number(digits[10]) === d2;
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

export function TemporaryMemberIntakeForm(props: {
  action: (formData: FormData) => void;
  ministries: Array<{ id: string; name: string }>;
}) {
  const initialTypes = useMemo(() => new Set<MemberTypeValue>(["MEMBER"]), []);
  const [selectedTypes, setSelectedTypes] = useState<Set<MemberTypeValue>>(initialTypes);
  const [selectedMinistryIds, setSelectedMinistryIds] = useState<Set<string>>(new Set());
  const [cpf, setCpf] = useState("");
  const [zip, setZip] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [baptized, setBaptized] = useState(false);
  const [baptismYear, setBaptismYear] = useState("");
  const [conversionYear, setConversionYear] = useState("");
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting">("idle");
  const [cpfError, setCpfError] = useState<string | null>(null);

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
    <form
      action={props.action}
      className="space-y-4"
      onSubmit={(e) => {
        if (submitStatus === "submitting") {
          e.preventDefault();
          return;
        }
        const raw = new FormData(e.currentTarget);
        const cpfDigits = String(raw.get("cpf") ?? "").replace(/\D/g, "");
        const types = raw.getAll("types");
        if (!validateCpf(cpfDigits)) {
          e.preventDefault();
          setCpfError("Informe um CPF valido (11 digitos numericos).");
          e.currentTarget.querySelector<HTMLInputElement>('input[name="cpf"]')?.focus();
          return;
        }
        if (!types.length) {
          e.preventDefault();
          return;
        }
        setCpfError(null);
        setSubmitStatus("submitting");
      }}
    >
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nome completo
        </div>
        <Input name="fullName" placeholder="Nome do membro" required />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CPF</div>
          <Input
            name="cpf"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => {
              setCpf(formatCpf(e.target.value));
              if (cpfError) setCpfError(null);
            }}
            required
          />
          {cpfError ? <div className="text-xs text-red-400">{cpfError}</div> : null}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">E-mail</div>
          <Input name="email" type="email" placeholder="email@exemplo.com" />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Telefone</div>
          <Input name="phone" placeholder="(00) 00000-0000" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tipos do cadastro
        </div>
        <div className="rounded-2xl border border-border/80 bg-muted/10 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Ministerios
        </div>
        <div className="rounded-2xl border border-border/80 bg-muted/10 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        <div className="text-xs text-muted-foreground">Pode selecionar mais de um ministerio.</div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-muted/10 p-4">
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
          <span>E batizado?</span>
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ano do batismo
            </div>
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
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ano de conversao
            </div>
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
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Endereco
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CEP</div>
            <Input
              name="zip"
              placeholder="00000-000"
              value={zip}
              onChange={(e) => setZip(normalizeCep(e.target.value))}
              onBlur={handleCepBlur}
            />
            {cepStatus === "error" ? (
              <div className="text-xs text-red-400">CEP invalido ou nao encontrado.</div>
            ) : null}
            {cepStatus === "loading" ? (
              <div className="text-xs text-muted-foreground">Buscando endereco...</div>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estado
            </div>
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
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cidade
            </div>
            <Input name="city" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bairro
            </div>
            <Input
              name="neighborhood"
              placeholder="Bairro"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Logradouro
          </div>
          <Input
            name="addressLine1"
            placeholder="Rua / Avenida"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Complemento / Numero
          </div>
          <Input
            name="addressLine2"
            placeholder="Apto, bloco, numero"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />
        </div>
      </div>

      <Button className="w-full" type="submit" disabled={submitStatus === "submitting"}>
        {submitStatus === "submitting" ? "Enviando..." : "Cadastrar membro"}
      </Button>
    </form>
  );
}
