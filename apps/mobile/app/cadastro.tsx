import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/Input";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Button } from "@/components/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAppTheme } from "@/theme";
import { useAuth } from "@/hooks/useAuth";
import { postVisitorRegistration } from "@/services/api/auth";
import { ApiError } from "@/services/api/client";

const schema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo."),
  cpf: z.string().refine(value => value.replace(/\D/g, "").length === 11, "Informe os 11 números do CPF."),
  email: z.string().trim().email("Informe um e-mail válido."),
  phone: z.string().refine(value => /^\d{10,13}$/.test(value.replace(/\D/g, "")), "Informe seu telefone com DDD."),
  password: z.string().min(8, "Use pelo menos 8 caracteres.").max(72, "Use até 72 caracteres."),
  confirmPassword: z.string().min(1, "Confirme sua senha."),
}).refine(data => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "As senhas precisam ser iguais." });
type Form = z.infer<typeof schema>;
const fields = [
  { name: "fullName", label: "Nome completo", placeholder: "Seu nome completo", max: 150, keyboard: "default" },
  { name: "cpf", label: "CPF", placeholder: "000.000.000-00", max: 14, keyboard: "number-pad" },
  { name: "email", label: "E-mail", placeholder: "seu@email.com", max: 255, keyboard: "email-address" },
  { name: "phone", label: "Telefone com DDD", placeholder: "(00) 00000-0000", max: 25, keyboard: "phone-pad" },
  { name: "password", label: "Senha", placeholder: "Pelo menos 8 caracteres", max: 72, keyboard: "default" },
  { name: "confirmPassword", label: "Confirmar senha", placeholder: "Digite sua senha novamente", max: 72, keyboard: "default" },
] as const;

export default function RegistrationScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { login } = useAuth();
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState(false);
  const { control, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { fullName: "", cpf: "", email: "", phone: "", password: "", confirmPassword: "" } });
  async function submit(data: Form) {
    setMessage("");
    try {
      await postVisitorRegistration({ fullName: data.fullName, cpf: data.cpf, email: data.email, phone: data.phone, password: data.password });
    } catch (error) {
      if (error instanceof ApiError && error.data?.issues) for (const [key, messages] of Object.entries(error.data.issues)) if (fields.some(field => field.name === key) && messages?.[0]) setError(key as keyof Form, { message: messages[0] });
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir o cadastro. Tente novamente.");
      return;
    }
    setCreated(true);
    reset();
    try { await login({ email: data.email.trim().toLowerCase(), password: data.password }); router.replace("/"); }
    catch { setMessage("Cadastro criado com sucesso. Entre com seu e-mail e senha para continuar."); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top", "left", "right", "bottom"]}>
    <View style={{ alignItems: "flex-end", paddingHorizontal: 20 }}><ThemeToggle /></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 40 }}>
        <Image source={require("../assets/icon.png")} accessibilityLabel="Viva Church" style={{ width: 64, height: 64, borderRadius: 20, alignSelf: "center" }} />
        <View style={{ gap: 8 }}><Text style={{ color: theme.colors.foreground, fontFamily: "Inter_700Bold", fontSize: 26 }}>Crie seu cadastro</Text><Text style={{ color: theme.colors.primary500, fontFamily: "Inter_600SemiBold" }}>Novo Visitante</Text><Text style={{ color: theme.colors.foregroundMuted, lineHeight: 21 }}>Seja bem-vindo à Viva Church! Seu cadastro terá os acessos de Visitante no aplicativo, incluindo cultos, eventos e Infantil para seus filhos.</Text></View>
        {!created ? <>{fields.map(field => <Controller key={field.name} control={control} name={field.name} render={({ field: input }) => <Input label={field.label} placeholder={field.placeholder} value={input.value} onChangeText={input.onChange} onBlur={input.onBlur} error={errors[field.name]?.message} keyboardType={field.keyboard} maxLength={field.max} autoCapitalize={field.name === "fullName" ? "words" : "none"} autoCorrect={false} editable={!isSubmitting} secureTextEntry={field.name === "password" || field.name === "confirmPassword"} />} />)}<PrimaryButton onPress={handleSubmit(submit)} loading={isSubmitting}>CRIAR CADASTRO</PrimaryButton></> : null}
        {message ? <Text accessibilityRole="alert" style={{ color: created ? theme.colors.foreground : theme.colors.danger500, lineHeight: 21 }}>{message}</Text> : null}
        <Button variant="ghost" disabled={isSubmitting} onPress={() => router.replace("/login")}>{created ? "Entrar com minha conta" : "Já tenho cadastro. Entrar"}</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
