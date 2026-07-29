import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/server/db";
import { logAudit } from "@/server/audit";
import { getTempMemberIntakePath, isTempMemberIntakeEnabled } from "@/server/temp-member-intake";
import { TemporaryMemberIntakeForm } from "./TemporaryMemberIntakeForm";

export const dynamic = "force-dynamic";

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;
type MemberTypeValue = "MEMBER" | "VISITOR" | "NEW_MEMBER" | "LEADER" | "VOLUNTEER" | "DISCIPLER";

const currentYear = new Date().getFullYear();

const yearField = z.preprocess((value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return n;
}, z.number().int().min(1900).max(currentYear).optional());

function validateCpfDigits(digits: string) {
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

const cpfField = z.preprocess((value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits;
}, z.string().refine((digits) => validateCpfDigits(digits), {
  message: "CPF invalido.",
}));

const createMemberSchema = z.object({
  fullName: z.string().min(2),
  cpf: cpfField,
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  ministryIds: z.array(z.string()).optional(),
  types: z
    .array(z.enum(["MEMBER", "VISITOR", "NEW_MEMBER", "LEADER", "VOLUNTEER", "DISCIPLER"]))
    .min(1),
  zip: z.string().optional().or(z.literal("")),
  addressLine1: z.string().optional().or(z.literal("")),
  addressLine2: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  baptized: z.boolean().optional(),
  baptismYear: yearField,
  conversionYear: yearField,
});

function getSelectedTypes(types: MemberTypeValue[]) {
  const unique = Array.from(new Set(types));
  return unique.length ? unique : (["MEMBER"] as MemberTypeValue[]);
}

function getPrimaryType(types: MemberTypeValue[]) {
  if (types.includes("MEMBER")) return "MEMBER";
  return types[0] ?? "MEMBER";
}

async function createTemporaryMember(formData: FormData) {
  "use server";

  if (!isTempMemberIntakeEnabled()) notFound();

  const intakePath = getTempMemberIntakePath();

  try {
    const parsed = createMemberSchema.safeParse({
      fullName: formData.get("fullName"),
      cpf: formData.get("cpf"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      ministryIds: formData.getAll("ministryIds").map((value) => String(value)),
      types: formData.getAll("types").map((value) => String(value)),
      zip: formData.get("zip"),
      addressLine1: formData.get("addressLine1"),
      addressLine2: formData.get("addressLine2"),
      neighborhood: formData.get("neighborhood"),
      city: formData.get("city"),
      state: formData.get("state"),
      baptized: formData.get("baptized") === "on",
      baptismYear: formData.get("baptismYear"),
      conversionYear: formData.get("conversionYear"),
    });

    if (!parsed.success) {
      const issueCode = parsed.error.issues.find((issue) => issue.path[0] === "cpf")?.code;
      if (issueCode) redirect(`${intakePath}?status=cpf-invalido`);
      redirect(`${intakePath}?status=erro`);
    }

    const selectedTypes = getSelectedTypes(parsed.data.types);
    const primaryType = getPrimaryType(selectedTypes);
    const normalizedCpf = parsed.data.cpf;
    const normalizedEmail = parsed.data.email ? parsed.data.email.toLowerCase().trim() : null;
    const baptized = Boolean(parsed.data.baptized);

    const existingByCpf = await prisma.member.findUnique({
      where: { cpf: normalizedCpf },
      select: { id: true },
    });
    if (existingByCpf) redirect(`${intakePath}?status=cpf-existente`);

    if (normalizedEmail) {
      const existingByEmail = await prisma.member.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingByEmail) redirect(`${intakePath}?status=email-existente`);
    }

    const ministryIds = Array.from(
      new Set((parsed.data.ministryIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
    );
    const validMinistries = ministryIds.length
      ? await prisma.ministry.findMany({
          where: { id: { in: ministryIds }, active: true },
          select: { id: true },
        })
      : [];
    const validMinistryIds = validMinistries.map((ministry) => ministry.id);

    const member = await prisma.member.create({
      data: {
        fullName: parsed.data.fullName.trim(),
        cpf: normalizedCpf,
        email: normalizedEmail,
        phone: parsed.data.phone ? String(parsed.data.phone).trim() : null,
        type: primaryType,
        types: selectedTypes,
        ministryId: validMinistryIds[0] ?? null,
        memberMinistries: validMinistryIds.length
          ? { createMany: { data: validMinistryIds.map((ministryId) => ({ ministryId })) } }
          : undefined,
        zip: parsed.data.zip ? String(parsed.data.zip).trim() : null,
        addressLine1: parsed.data.addressLine1 ? String(parsed.data.addressLine1).trim() : null,
        addressLine2: parsed.data.addressLine2 ? String(parsed.data.addressLine2).trim() : null,
        neighborhood: parsed.data.neighborhood ? String(parsed.data.neighborhood).trim() : null,
        city: parsed.data.city ? String(parsed.data.city).trim() : null,
        state: parsed.data.state ? String(parsed.data.state).trim().toUpperCase().slice(0, 2) : null,
        baptized,
        baptismYear: baptized ? parsed.data.baptismYear ?? null : null,
        conversionYear: parsed.data.conversionYear ?? null,
      },
    });

    try {
      await logAudit({
        actorUserId: null,
        action: "CREATE_TEMP_PUBLIC",
        entityType: "Member",
        entityId: member.id,
        after: {
          id: member.id,
          fullName: member.fullName,
          cpf: member.cpf,
          email: member.email,
          phone: member.phone,
          type: member.type,
          types: member.types,
          source: "temp-public-intake",
        },
      });
    } catch {
      // audit nao deve quebrar o cadastro publico
    }

    redirect(`${intakePath}?status=ok`);
  } catch (err) {
    console.error("[temp-members] Falha ao processar cadastro temporario:", err);
    redirect(`${intakePath}?status=falha-servidor`);
  }
}

function getMessage(status: string | undefined) {
  if (status === "ok") {
    return {
      tone: "success",
      text: "Cadastro enviado com sucesso. O membro ja foi incluido no sistema.",
    } as const;
  }

  if (status === "email-existente") {
    return {
      tone: "warning",
      text: "Ja existe um cadastro com este e-mail no sistema.",
    } as const;
  }

  if (status === "cpf-existente") {
    return {
      tone: "warning",
      text: "Ja existe um cadastro com este CPF no sistema.",
    } as const;
  }

  if (status === "cpf-invalido") {
    return {
      tone: "warning",
      text: "CPF informado e invalido. Revise os digitos e tente novamente.",
    } as const;
  }

  if (status === "falha-servidor") {
    return {
      tone: "warning",
      text: "Nao foi possivel salvar neste momento. Tente novamente em instantes.",
    } as const;
  }

  if (status === "erro") {
    return {
      tone: "warning",
      text: "Nao foi possivel concluir o cadastro. Revise os campos e tente novamente.",
    } as const;
  }

  return null;
}

export default async function TemporaryMembersPage(props: { searchParams?: SearchParamsInput }) {
  if (!isTempMemberIntakeEnabled()) notFound();

  const searchParams = props.searchParams ? await props.searchParams : {};
  const statusValue = searchParams.status;
  const status = Array.isArray(statusValue) ? statusValue[0] : statusValue;
  const message = getMessage(status);

  const ministries = await prisma.ministry.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
        <Card className="w-full border-border/80 bg-[rgba(11,23,48,0.58)] p-6 backdrop-blur-xl">
          <div className="text-lg font-semibold tracking-tight">Preencher cadastro</div>
          <div className="mt-5">
            {message ? (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  message.tone === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-100"
                }`}
              >
                {message.text}
              </div>
            ) : null}
            <TemporaryMemberIntakeForm action={createTemporaryMember} ministries={ministries} />
          </div>
        </Card>
      </div>
    </div>
  );
}
