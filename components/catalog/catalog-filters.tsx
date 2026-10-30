"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/catalog/labels";
import { loadCatalogQuery, saveCatalogQuery } from "@/lib/catalog/saved-query";
import { cn } from "@/lib/utils";

const TIERS = [1, 2, 3, 4, 5, 6, 7, 8];
const ENCHANTS = [0, 1, 2, 3, 4];

const selectClass =
  "h-11 rounded-xl border border-glass-border bg-black/25 px-3 text-sm text-foreground focus:border-violet/60 focus:outline-none";

/** Filtros do catálogo: tudo vira query string, então a URL pode ser compartilhada. */
export function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("p"); // filtro novo volta para a página 1
    // Salva já: se o usuário limpou tudo, a URL vazia não deve restaurar a anterior.
    saveCatalogQuery(next.toString());
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Lembra a pesquisa; ao chegar sem filtros, retoma a última da aba.
  const current = params.toString();
  useEffect(() => {
    if (!current) {
      const saved = loadCatalogQuery();
      if (saved) {
        router.replace(`${pathname}?${saved}`, { scroll: false });
        return;
      }
    }
    saveCatalogQuery(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Mantém a caixa de busca alinhada à URL (voltar/avançar, restauração).
  const urlQuery = params.get("q") ?? "";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery((q) => (q.trim() === urlQuery ? q : urlQuery));
  }, [urlQuery]);

  // Busca com espera de 300 ms após parar de digitar.
  useEffect(() => {
    if (query.trim() === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: query.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="glass grid grid-cols-1 gap-3 rounded-2xl p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_120px_140px]">
      <label
        className={cn(
          "flex h-11 items-center gap-2.5 rounded-xl border border-glass-border bg-black/25 px-3.5 focus-within:border-violet/60 sm:col-span-2 lg:col-span-1",
          pending && "border-violet/40",
        )}
      >
        <Search className={cn("size-4 text-subtle", pending && "animate-pulse text-violet-soft")} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou ID (ex.: maça, T6_MAIN_MACE)"
          aria-label="Buscar itens"
          className="h-full w-full bg-transparent text-sm placeholder:text-subtle focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Limpar busca" className="text-subtle hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </label>

      <select
        aria-label="Categoria"
        className={selectClass}
        value={params.get("cat") ?? ""}
        onChange={(e) => update({ cat: e.target.value })}
      >
        <option value="">Todas as categorias</option>
        {CATEGORY_ORDER.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>

      <select
        aria-label="Tier"
        className={selectClass}
        value={params.get("tier") ?? ""}
        onChange={(e) => update({ tier: e.target.value })}
      >
        <option value="">Tier</option>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            T{t}
          </option>
        ))}
      </select>

      <select
        aria-label="Encantamento"
        className={selectClass}
        value={params.get("ench") ?? ""}
        onChange={(e) => update({ ench: e.target.value })}
      >
        <option value="">Encantamento</option>
        {ENCHANTS.map((e) => (
          <option key={e} value={e}>
            {e === 0 ? "Sem (.0)" : `.${e}`}
          </option>
        ))}
      </select>
    </div>
  );
}
