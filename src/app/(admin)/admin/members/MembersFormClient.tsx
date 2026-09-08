"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  safeImageSrc,
  safeImageSrcOrUndefined,
} from "@/lib/safe-image-src";
import {
  createMember,
  updateMember,
  type MemberActionResult,
} from "./actions";

type MemberTypeValue =
  | "MEMBER"
  | "VISITOR"
  | "NEW_MEMBER"
  | "LEADER"
  | "VOLUNTEER"
  | "DISCIPLER";

const memberTypeOptions: Array<{ value: MemberTypeValue; label: string }> = [
  { value: "MEMBER", label: "Membro" },
  { value: "VISITOR", label: "Visitante" },
  { value: "NEW_MEMBER", label: "Novo membro" },
  { value: "LEADER", label: "Líder" },
  { value: "VOLUNTEER", label: "Voluntário" },
  { value: "DISCIPLER", label: "Discipulador" },
];

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    cache: "no-store",
  });
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

async function uploadAvatarToApi(file: File): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string }
> {
  try {
    const form = new FormData();
    form.append("photoFile", file);
    const res = await fetch("/api/uploads/member-avatar", {
      method: "POST",
      body: form,
    });
    const payload = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok || !payload || payload.ok !== true) {
      return {
        ok: false,
        error:
          typeof payload?.error === "string" && payload.error.length
            ? payload.error
            : res.status === 413
              ? "Foto muito grande. Tamanho máximo permitido: 2MB."
              : res.status === 403 || res.status === 401
                ? "Sessão expirou ou você não tem permissão para enviar fotos. Recarregue a página e tente novamente."
                : `Falha ao enviar foto (HTTP ${res.status}).`,
      };
    }
    if (typeof payload.url !== "string" || !payload.url.length) {
      return { ok: false, error: "Resposta inválida ao salvar foto." };
    }
    return { ok: true, url: payload.url };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err ?? "desconhecido");
    return {
      ok: false,
      error: `Erro ao enviar foto (${message}).`,
    };
  }
}

export function MembersFormClient(props: {
  mode: "create" | "edit";
  title: string;
  submitLabel: string;
  ministries: Array<{ id: string; name: string }>;
  defaultValues?: Partial<{
    memberId: string;
    fullName: string;
    photoUrl: string | null;
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    safeImageSrc(props.defaultValues?.photoUrl ?? null),
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const photoUrlHiddenRef = useRef<HTMLInputElement>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const serverAction = props.mode === "edit" ? updateMember : createMember;
  const [actionState, formAction, isPending] = useActionState(serverAction, { ok: false });
  const [_tr, startTransition] = useTransition();

  useEffect(() => {
    setPhotoPreview(safeImageSrc(props.defaultValues?.photoUrl ?? null));
  }, [props.defaultValues?.photoUrl]);

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

  function validateFile(file: File): string | null {
    if (!file) return null;
    if (!ALLOWED_MIME.has(file.type)) {
      return `Formato não permitido (${file.type || "desconhecido"}). Aceitos: JPG, PNG, WEBP.`;
    }
    if (file.size <= 0) return "Arquivo de foto vazio.";
    if (file.size > MAX_AVATAR_BYTES) {
      const mb = MAX_AVATAR_BYTES / 1024 / 1024;
      return `Foto muito grande. Tamanho máximo permitido: ${mb.toFixed(0)}MB.`;
    }
    return null;
  }

  const initialState: MemberActionResult = { ok: false };

  return (
    <div>
      <div className="text-sm font-medium">{props.title}</div>
      <form
        ref={formRef}
        onSubmit={async (event) => {
          const formData = new FormData(event.currentTarget);
          event.preventDefault();
          startTransition(async () => {
            const pendingFile = photoFileInputRef.current?.files?.[0] ?? null;
            if (pendingFile) {
              const validationError = validateFile(pendingFile);
              if (validationError) {
                setFileError(validationError);
                return;
              }
              setFileError(null);
              setIsUploading(true);
              const uploadRes = await uploadAvatarToApi(pendingFile);
              setIsUploading(false);
              if (!uploadRes.ok) {
                setFileError(uploadRes.error);
                return;
              }
              if (photoUrlHiddenRef.current) {
                photoUrlHiddenRef.current.value = uploadRes.url;
              }
              formData.set("photoUrl", uploadRes.url);
              if (photoFileInputRef.current) {
                try {
                  const dt = new DataTransfer();
                  photoFileInputRef.current.files = dt.files;
                } catch {
                  // não importa; já passamos photoUrl hidden
                }
              }
            } else {
              setFileError(null);
            }

            formAction(formData);
          });
        }}
        action={formAction as unknown as (formData: FormData) => void}
        className="mt-4 space-y-3"
        encType="multipart/form-data"
      >
        <input
          ref={photoUrlHiddenRef}
          type="hidden"
          name="photoUrl"
          defaultValue=""
          autoComplete="off"
        />
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
          <div className="text-xs font-medium text-muted-foreground">Foto de perfil</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-muted/10">
              {(() => {
                const src = safeImageSrcOrUndefined(photoPreview);
                if (!src) {
                  return (
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sem foto
                    </div>
                  );
                }
                return (
                  <Image
                    src={src}
                    alt="Pré-visualização"
                    width={80}
                    height={80}
                    className="size-full object-cover"
                    unoptimized
                    loader={({ src: s }) => s}
                  />
                );
              })()}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                ref={photoFileInputRef}
                type="file"
                name="photoFile"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) {
                    setPhotoPreview(safeImageSrc(props.defaultValues?.photoUrl ?? null));
                    setFileError(null);
                    return;
                  }
                  const validationError = validateFile(file);
                  if (validationError) {
                    setFileError(validationError);
                    setPhotoPreview(safeImageSrc(props.defaultValues?.photoUrl ?? null));
                    return;
                  }
                  setFileError(null);
                  const reader = new FileReader();
                  reader.onload = () =>
                    setPhotoPreview(safeImageSrc(reader.result) ?? null);
                  reader.readAsDataURL(file);
                }}
                className="block w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-muted/30 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground hover:file:bg-muted/40"
              />
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                <div className="text-xs text-muted-foreground">
                  Formatos aceitos: JPG, PNG ou WEBP. Até 2MB.
                </div>
              </div>
              {fileError ? (
                <div className="rounded-2xl border border-red-400/60 bg-red-500/10 p-3 text-xs font-medium text-red-400">
                  {fileError}
                </div>
              ) : null}
              {isUploading ? (
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                  Enviando foto…
                </div>
              ) : null}
              {photoPreview && props.defaultValues?.photoUrl !== photoPreview ? (
                <Button
                  variant="ghost"
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setPhotoPreview(safeImageSrc(props.defaultValues?.photoUrl ?? null));
                    setFileError(null);
                    if (photoFileInputRef.current) photoFileInputRef.current.value = "";
                  }}
                >
                  Manter foto atual
                </Button>
              ) : null}
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

        <div className="space-y-2">
          <Button className="w-full" type="submit" disabled={isPending || isUploading}>
            {isPending
              ? "Salvando…"
              : isUploading
                ? "Enviando foto e salvando…"
                : props.submitLabel}
          </Button>

          {actionState?.ok && actionState?.message ? (
            <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-400">
              {actionState.message}
            </div>
          ) : null}

          {actionState && !actionState.ok && actionState?.error ? (
            <div className="rounded-2xl border border-red-400/60 bg-red-500/10 p-3 text-xs font-medium text-red-400">
                Erro ao salvar: {actionState.error}
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}
