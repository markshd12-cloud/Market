"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { updateConstant } from "@/app/(app)/admin/actions";
import { cn } from "@/lib/utils";

export type GameConstant = {
  key: string;
  value: number;
  unit: string;
  label: string;
  description: string | null;
  category: string;
  status: "confirmado" | "a_confirmar";
  source: string | null;
};

export function ConstantRow({ constant }: { constant: GameConstant }) {
  const [state, action, pending] = useActionState(updateConstant, undefined);

  return (
    <form
      action={action}
      className="grid grid-cols-1 items-center gap-3 rounded-xl border border-glass-border bg-white/[0.02] p-3.5 sm:grid-cols-[1fr_auto_auto_auto]"
    >
      <input type="hidden" name="key" value={constant.key} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{constant.label}</p>
        <p className="truncate text-xs text-muted" title={constant.description ?? undefined}>
          {constant.description}
        </p>
        <p className="mt-0.5 font-mono text-[0.65rem] text-subtle">{constant.key}</p>
      </div>

      <label className="flex h-10 items-center gap-2 rounded-lg border border-glass-border bg-black/25 px-3 focus-within:border-violet/60">
        <input
          name="value"
          defaultValue={constant.value}
          inputMode="decimal"
          aria-label={`Valor de ${constant.label}`}
          className="w-16 bg-transparent text-right font-mono text-sm focus:outline-none"
        />
        <span className="text-xs text-muted">{constant.unit}</span>
      </label>

      <select
        name="status"
        defaultValue={constant.status}
        aria-label="Status"
        className={cn(
          "h-10 rounded-lg border border-glass-border bg-black/25 px-2.5 text-xs focus:border-violet/60 focus:outline-none",
          constant.status === "confirmado" ? "text-emerald-300" : "text-amber-300",
        )}
      >
        <option value="a_confirmar">A confirmar</option>
        <option value="confirmado">Confirmado</option>
      </select>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-violet/40 bg-violet/15 px-3 text-xs font-medium text-violet-soft transition-colors hover:bg-violet/25 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Salvar
      </button>

      {(state?.error || state?.ok) && (
        <p className={cn("text-xs sm:col-span-4", state.error ? "text-rose-300" : "text-emerald-300")}>
          {state.error ?? "Salvo."}
        </p>
      )}
    </form>
  );
}
