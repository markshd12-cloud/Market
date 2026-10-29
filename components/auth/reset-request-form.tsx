"use client";

import { Mail, Send } from "lucide-react";
import { useActionState } from "react";

import { requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.message) return <FormAlert message={state.message} />;

  return (
    <form action={action} className="space-y-4">
      <FormAlert error={state?.error} />
      <Input
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        required
        icon={<Mail className="size-4" />}
      />
      <Button type="submit" loading={pending} className="w-full">
        Enviar link <Send className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
