"use client";

import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";
import { useActionState } from "react";

import { signUp } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, undefined);

  if (state?.message) return <FormAlert message={state.message} />;

  return (
    <form action={action} className="space-y-4">
      <FormAlert error={state?.error} />

      <Input
        label="Nome de exibição"
        name="displayName"
        autoComplete="nickname"
        placeholder="Seu nick no jogo"
        minLength={2}
        maxLength={32}
        required
        icon={<UserRound className="size-4" />}
      />
      <Input
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        required
        icon={<Mail className="size-4" />}
      />
      <Input
        label="Senha"
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
        Criar conta <ArrowRight className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
