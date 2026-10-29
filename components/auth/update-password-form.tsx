"use client";

import { Check, Lock } from "lucide-react";
import { useActionState } from "react";

import { updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormAlert error={state?.error} />
      <Input
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo de 8 caracteres"
        minLength={8}
        required
        icon={<Lock className="size-4" />}
      />
      <Input
        label="Confirmar senha"
        name="confirm"
        type="password"
        autoComplete="new-password"
        placeholder="Repita a senha"
        minLength={8}
        required
        icon={<Lock className="size-4" />}
      />
      <Button type="submit" loading={pending} className="w-full">
        Salvar senha <Check className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
