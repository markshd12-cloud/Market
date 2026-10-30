"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { controlClass, Field } from "@/components/ui/field";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/catalog/labels";
import {
  CONFIDENCE_STEPS,
  DEFAULT_MINE_WINDOW,
  MINE_WINDOWS,
  MODE_LABELS,
  SORT_LABELS,
  type OpportunityMode,
  type RouteFixed,
} from "@/lib/opportunities";
import { cn } from "@/lib/utils";

const TIERS = [1, 2, 3, 4, 5, 6, 7, 8];

const selectClass = controlClass;

/**
 * Filtros das rotas: tudo na query string (URL compartilhável).
 * `fixed` esconde o que a página já define (ex.: Black Market fixa destino e modo).
 */
export function RouteFilters({
  locations,
  fixed = {},
}: {
  locations: string[];
  fixed?: RouteFixed;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const origins = locations.filter((l) => l !== "Black Market");
  const mode = (params.get("modo") as OpportunityMode) || "instant";
  // Ordem de venda não existe no Black Market.
  const dests = fixed.mode === "order" || mode === "order" ? origins : locations;

  return (
    <div
      className={cn(
        "glass grid grid-cols-2 gap-3 rounded-2xl p-3 transition-opacity sm:grid-cols-3 xl:grid-cols-7",
        pending && "opacity-70",
      )}
      aria-busy={pending}
    >
      {fixed.mine && (
        <Field label="Capturados nas últimas">
          <select
            className={selectClass}
            value={params.get("janela") ?? String(DEFAULT_MINE_WINDOW)}
            onChange={(e) => update("janela", e.target.value)}
          >
            {MINE_WINDOWS.map((h) => (
              <option key={h} value={h}>
                {h < 24 ? `${h} h` : `${h / 24} ${h === 24 ? "dia" : "dias"}`}
              </option>
            ))}
          </select>
        </Field>
      )}

      {!fixed.mode && (
        <Field label="Modo">
          <select className={selectClass} value={mode} onChange={(e) => update("modo", e.target.value)}>
            {(Object.keys(MODE_LABELS) as OpportunityMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Comprar em">
        <select className={selectClass} value={params.get("de") ?? ""} onChange={(e) => update("de", e.target.value)}>
          <option value="">Qualquer cidade</option>
          {origins.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>

      {!fixed.dest && (
        <Field label="Vender em">
          <select
            className={selectClass}
            value={params.get("para") ?? ""}
            onChange={(e) => update("para", e.target.value)}
          >
            <option value="">Qualquer local</option>
            {dests.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Categoria">
        <select className={selectClass} value={params.get("cat") ?? ""} onChange={(e) => update("cat", e.target.value)}>
          <option value="">Todas</option>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tier">
        <select className={selectClass} value={params.get("tier") ?? ""} onChange={(e) => update("tier", e.target.value)}>
          <option value="">Todos</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              T{t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Confiança mín.">
        <select className={selectClass} value={params.get("conf") ?? ""} onChange={(e) => update("conf", e.target.value)}>
          <option value="">Padrão</option>
          {CONFIDENCE_STEPS.map((c) => (
            <option key={c} value={c}>
              {c === 0 ? "Mostrar tudo" : `${c}+`}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Ordenar por">
        <select className={selectClass} value={params.get("ord") ?? "profit"} onChange={(e) => update("ord", e.target.value)}>
          {Object.entries(SORT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
