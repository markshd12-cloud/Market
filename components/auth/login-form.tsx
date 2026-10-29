"use client";

import { ArrowRight, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormAlert error={state?.error ?? notice} message={state?.message} />

      <Input
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        required
        icon={<Mail className="size-4" />}
      />
      <div className="space-y-2">
        <Input
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          icon={<Lock className="size-4" />}
        />
        <div className="text-right">
          <Link href="/recuperar-senha" className="text-xs text-violet-soft transition-colors hover:text-cyan">
            Esqueci a senha
          </Link>
        </div>
      </div>

      <Button type="submit" loading={pending} className="w-full">
        Entrar <ArrowRight className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
