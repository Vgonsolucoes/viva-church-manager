import { z } from "zod";

export function validCpf(digits: string) {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return Number(digits[9]) === digit(9) && Number(digits[10]) === digit(10);
}

export const visitorRegistrationSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo.").max(150),
  cpf: z.string().max(20).transform(value => value.replace(/\D/g, "")).refine(validCpf, "Informe um CPF válido."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(255),
  phone: z.string().max(25).transform(value => value.replace(/\D/g, "")).refine(value => /^\d{10,13}$/.test(value), "Informe seu telefone com DDD."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72).refine(value => new TextEncoder().encode(value).length <= 72, "Use uma senha com até 72 bytes."),
}).strict();
