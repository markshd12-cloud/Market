import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default function UpdatePasswordPage() {
  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha nova para a sua conta.">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
