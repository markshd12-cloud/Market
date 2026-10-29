import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetRequestForm } from "@/components/auth/reset-request-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviaremos um link para você criar uma nova senha."
      footer={
        <Link href="/login" className="font-medium text-violet-soft hover:text-cyan">
          Voltar para o login
        </Link>
      }
    >
      <ResetRequestForm />
    </AuthShell>
  );
}
