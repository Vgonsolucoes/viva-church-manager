import { api } from "@/services/api/client";
import {
  LoginInputSchema,
  LoginResponseSchema,
  type LoginInput,
  type LoginResponse,
} from "@/types";

export async function postLogin(input: LoginInput): Promise<LoginResponse> {
  const parsed = LoginInputSchema.parse(input);
  const res = await api.post<unknown>(
    "/api/v1/auth/mobile/login",
    parsed,
    { skipAuth: true },
  );
  return LoginResponseSchema.parse(res);
}

export async function postVisitorRegistration(input: { fullName: string; cpf: string; email: string; phone: string; password: string }): Promise<void> {
  await api.post("/api/v1/auth/mobile/register", input, { skipAuth: true });
}
