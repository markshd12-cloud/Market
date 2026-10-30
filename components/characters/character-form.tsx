"use client";

import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { useActionState } from "react";

import { deleteCharacter, saveCharacter } from "@/app/(app)/personagens/actions";
import { controlClass, Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { cn } from "@/lib/utils";

export type CharacterFormValues = {
  id?: string;
  name: string;
  premium: boolean;
  home_city: string | null;
  goal_amount: number | null;
  goal_days: number | null;
  goal_start?: string;
};

const EMPTY: CharacterFormValues = { name: "", premium: true, home_city: null, goal_amount: null, goal_days: null };

/** Cria ou edita um personagem. Sem `initial` = formulário de novo personagem. */
export function CharacterForm({ initial, locations }: { initial?: CharacterFormValues; locations: string[] }) {
  const [state, action, pending] = useActionState(saveCharacter, undefined);
  const v = initial ?? EMPTY;
  const isNew = !v.id;

  return (
    <div className="space-y-3">
      <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {v.id && <input type="hidden" name="id" value={v.id} />}
        <Field label="Nome no jogo" className="col-span-2 sm:col-span-1 lg:col-span-2">
          <input name="name" defaultValue={v.name} required minLength={2} maxLength={32} className={controlClass} />
        </Field>
        <Field label="Cidade base">
          <select name="home_city" defaultValue={v.home_city ?? ""} className={controlClass}>
            <option value="">—</option>
            {locations
              .filter((l) => l !== "Black Market")
              .map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Meta" hint="ex.: 100M">
          <input
            name="goal_amount"
            defaultValue={v.goal_amount ? v.goal_amount.toLocaleString("pt-BR") : ""}
            inputMode="decimal"
            placeholder="100M"
            className={cn(controlClass, "font-mono")}
          />
        </Field>
        <Field label="Prazo (dias)">
          <input
            name="goal_days"
            type="number"
            min={1}
            max={365}
            defaultValue={v.goal_days ?? ""}
            placeholder="20"
            className={cn(controlClass, "font-mono")}
          />
        </Field>
        <Field label="Início da meta">
          <input name="goal_start" type="date" defaultValue={v.goal_start ?? ""} className={controlClass} />
        </Field>

        <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-3 lg:col-span-6">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              name="premium"
              defaultChecked={v.premium}
              className="size-4 accent-violet-500"
            />
            Premium (taxa de venda menor)
          </label>
          <button
            type="submit"
            disabled={pending}
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/15 px-4 text-sm font-medium text-violet-soft transition-colors hover:bg-violet/25 disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
            {isNew ? "Criar personagem" : "Salvar"}
          </button>
        </div>
      </form>

      {!isNew && (
        <form
          action={deleteCharacter}
          onSubmit={(e) => {
            if (!confirm(`Apagar ${v.name}? As operações e o banco dele somem junto.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={v.id} />
          <button type="submit" className="inline-flex items-center gap-1.5 text-xs text-subtle hover:text-rose-300">
            <Trash2 className="size-3.5" /> Apagar personagem
          </button>
        </form>
      )}

      {state?.error && <FormAlert error={state.error} />}
      {state?.ok && isNew && <FormAlert message="Personagem criado." />}
    </div>
  );
}
