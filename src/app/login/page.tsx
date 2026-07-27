import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "@/app/login/ui/LoginForm";
import { Suspense } from "react";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="https://vgon.com.br/wp-content/uploads/2026/05/653710779_1244850837750825_1067912328932006259_n.png"
              alt="Ministério Viva Church"
              width={44}
              height={44}
              className="rounded-xl"
              style={{ width: "auto", height: "auto" }}
              priority
            />
            <div>
              <div className="text-sm font-semibold tracking-wide text-primary">
                Viva Church Manager
              </div>
              <div className="text-sm text-muted-foreground">
                Acesso administrativo e de membros
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
        <Card className="p-6">
          <div className="text-lg font-semibold">Entrar</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Use seu e-mail e senha.
          </div>
          <div className="mt-5">
            <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando...</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </Card>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Ministério Viva Church
        </div>
      </div>
    </div>
  );
}
