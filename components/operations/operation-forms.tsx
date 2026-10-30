"use client";

import { Check, LoaderCircle, Plus, Skull } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";

import { closeOperation, createOperation, saveBalance } from "@/app/(app)/operacoes/actions";
import { controlClass, Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { qualityLabel } from "@/lib/catalog/labels";
import { cn } from "@/lib/utils";

import { ItemPicker } from "./item-picker";

const QUALITIES = [1, 2, 3, 4, 5];

const submitClass =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-violet/40 bg-violet/15 px-4 text-sm font-medium text-violet-soft transition-colors hover:bg-violet/25 disabled:opacity-60";

/** Valores vindos do botão "Registrar" das rotas. */
export type OperationPrefill = {
  item: string;
  itemLabel: string;
  quality?: string;
  quantity?: string;
  buyLocation?: string;
  buyPrice?: string;
  sellLocation?: string;
  saleMode?: string;
  expected?: string;
};

function LocationSelect({ name, locations, defaultValue }: { name: string; locations: string[]; defaultValue?: string }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className={controlClass}>
      <option value="">—</option>
      {locations.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Registrar compra. Com `prefill`, vem pronto da página de rotas. */
export function NewOperationForm({
  characterId,
  locations,
  prefill,
}: {
  characterId: string;
  locations: string[];
  prefill?: OperationPrefill;
}) {
  const [state, action, pending] = useActionState(createOperation, undefined);
  const p = prefill;

  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      <input type="hidden" name="character_id" value={characterId} />
      {p && <input type="hidden" name="from_route" value="1" />}

      <Field label="Item" className="col-span-2 sm:col-span-4 lg:col-span-3">
        <ItemPicker key={state?.at ?? 0} name="item_id" initial={p ? { id: p.item, label: p.itemLabel } : undefined} />
      </Field>
      <Field label="Qualidade">
        <select name="quality" defaultValue={p?.quality ?? "1"} className={controlClass}>
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {qualityLabel(q)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantidade">
        <input
          name="quantity"
          inputMode="numeric"
          required
          defaultValue={p?.quantity ?? ""}
          className={cn(controlClass, "font-mono")}
        />
      </Field>
      <Field label="Preço de compra (un.)">
        <input
          name="buy_price"
          inputMode="decimal"
          required
          placeholder="12.500"
          defaultValue={p?.buyPrice ?? ""}
          className={cn(controlClass, "font-mono")}
        />
      </Field>

      <Field label="Comprado em">
        <LocationSelect
          name="buy_location"
          locations={locations.filter((l) => l !== "Black Market")}
          defaultValue={p?.buyLocation}
        />
      </Field>
      <Field label="Vender em (plano)">
        <LocationSelect name="sell_location" locations={locations} defaultValue={p?.sellLocation} />
      </Field>
      <Field label="Modo de venda">
        <select name="sale_mode" defaultValue={p?.saleMode ?? "instant"} className={controlClass}>
          <option value="instant">Venda imediata</option>
          <option value="order">Ordem de venda</option>
        </select>
      </Field>
      <Field label="Lucro previsto" hint="vem das rotas; opcional">
        <input
          name="expected_profit"
          inputMode="decimal"
          defaultValue={p?.expected ?? ""}
          className={cn(controlClass, "font-mono")}
        />
      </Field>
      <Field label="Nota" className="col-span-2 sm:col-span-3 lg:col-span-1">
        <input name="note" maxLength={280} className={controlClass} />
      </Field>
      <div className="col-span-2 flex items-end sm:col-span-1">
        <button type="submit" disabled={pending} className={cn(submitClass, "w-full")}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Registrar
        </button>
      </div>

      {state?.error && (
        <div className="col-span-full">
          <FormAlert error={state.error} />
        </div>
      )}
      {state?.ok && (
        <div className="col-span-full">
          <FormAlert message="Operação registrada." />
        </div>
      )}
    </form>
  );
}

/** Fechar uma operação aberta: venda (com preço) ou perda. */
export function CloseOperationForm({
  id,
  locations,
  defaultLocation,
  defaultMode,
}: {
  id: number;
  locations: string[];
  defaultLocation: string | null;
  defaultMode: "instant" | "order";
}) {
  const [state, action, pending] = useActionState(closeOperation, undefined);
  const [outcome, setOutcome] = useState<"vendida" | "perdida">("vendida");

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="outcome" value={outcome} />
      <div className="flex gap-1.5" role="radiogroup" aria-label="Resultado">
        {(["vendida", "perdida"] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={outcome === o}
            onClick={() => setOutcome(o)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs",
              outcome === o
                ? o === "vendida"
                  ? "border-success/50 bg-success/15 text-emerald-300"
                  : "border-rose-400/50 bg-rose-400/15 text-rose-300"
                : "border-glass-border text-muted hover:text-foreground",
            )}
          >
            {o === "vendida" ? "Vendi" : "Perdi"}
          </button>
        ))}
      </div>

      {outcome === "vendida" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            name="sell_price"
            inputMode="decimal"
            required
            placeholder="Preço/un."
            aria-label="Preço de venda por unidade"
            className={cn(controlClass, "h-10 font-mono")}
          />
          <select
            name="sell_location"
            defaultValue={defaultLocation ?? ""}
            aria-label="Vendido em"
            className={cn(controlClass, "h-10")}
          >
            <option value="">Local</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select name="sale_mode" defaultValue={defaultMode} aria-label="Modo" className={cn(controlClass, "h-10")}>
            <option value="instant">Imediata</option>
            <option value="order">Ordem</option>
          </select>
          <input
            name="fees"
            inputMode="decimal"
            placeholder="Taxas (auto)"
            title="Deixe vazio para calcular pelas taxas do jogo"
            aria-label="Taxas pagas"
            className={cn(controlClass, "h-10 font-mono")}
          />
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-rose-300">
          <Skull className="size-3.5" aria-hidden /> Conta como prejuízo do valor de compra inteiro.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={cn(submitClass, "h-9 px-3 text-xs")}>
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Fechar operação
        </button>
        {state?.error && <span className="text-xs text-rose-300">{state.error}</span>}
      </div>
    </form>
  );
}

/** Informar o banco atual do personagem. */
export function BalanceForm({ characterId }: { characterId: string }) {
  const [state, action, pending] = useActionState(saveBalance, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="character_id" value={characterId} />
      <div className="flex gap-2">
        <input
          name="balance"
          inputMode="decimal"
          required
          placeholder="Ex.: 18,4M"
          aria-label="Banco atual"
          className={cn(controlClass, "font-mono")}
        />
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          Salvar
        </button>
      </div>
      {state?.error && <p className="text-xs text-rose-300">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-300">Banco atualizado.</p>}
    </form>
  );
}

/** Troca o personagem da página (?p=). */
export function CharacterSwitcher({
  characters,
  current,
}: {
  characters: { id: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (characters.length < 2) return null;
  return (
    <select
      aria-label="Personagem"
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("p", e.target.value);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      className={cn(controlClass, "w-auto min-w-40")}
    >
      {characters.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
