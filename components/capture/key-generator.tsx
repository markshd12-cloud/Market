"use client";

import { Check, Copy, KeyRound, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { createCaptureKey } from "@/app/(app)/captura/actions";
import { controlClass } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { captureCommand } from "@/lib/capture";
import { cn } from "@/lib/utils";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-glass-border px-2 py-1 text-xs text-muted hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : label}
    </button>
  );
}

/** Gera a chave e mostra o comando pronto (a chave só aparece agora). */
export function KeyGenerator({ baseUrl }: { baseUrl: string }) {
  const [state, action, pending] = useActionState(createCaptureKey, undefined);

  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2">
        <input name="label" placeholder="Nome do PC (ex.: PC de casa)" maxLength={40} className={controlClass} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-violet/40 bg-violet/15 px-4 text-sm font-medium text-violet-soft hover:bg-violet/25 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Gerar chave
        </button>
      </form>

      {state?.error && <FormAlert error={state.error} />}
      {state?.key && (
        <div className="space-y-2 rounded-xl border border-success/30 bg-success/10 p-3.5">
          <p className="text-sm text-emerald-200">
            Chave criada. <b>Copie agora</b>: ela não aparece de novo.
          </p>
          <CommandLine text={captureCommand(baseUrl, state.key)} />
        </div>
      )}
    </div>
  );
}

export function CommandLine({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border border-glass-border bg-black/40 p-2", className)}>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-cyan">{text}</code>
      <CopyButton text={text} />
    </div>
  );
}
