import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  link: "Link inválido ou expirado. Solicite um novo.",
};

async function LoginWithNotice({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <LoginForm notice={erro ? NOTICES[erro] : undefined} />;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse seu painel de mercado."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-violet-soft hover:text-cyan">
            Criar conta
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoginForm />}>
        <LoginWithNotice searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
