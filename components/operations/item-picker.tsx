"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ItemIcon } from "@/components/catalog/item-icon";
import { TierBadge } from "@/components/catalog/tier-badge";
import { controlClass } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Hit = { id: string; name_pt: string | null; name_en: string | null; tier: number | null; enchant: number };

const label = (h: Hit) => h.name_pt ?? h.name_en ?? h.id;
const sanitize = (s: string) => s.replace(/[,()%*\\]/g, " ").trim().slice(0, 60);

/** Busca de item no catálogo (direto no Supabase, RLS de leitura). Grava o ID em `name`. */
export function ItemPicker({ name, initial }: { name: string; initial?: { id: string; label: string } }) {
  const [selected, setSelected] = useState(initial ?? null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = sanitize(query);
    if (q.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("items")
        .select("id, name_pt, name_en, tier, enchant")
        .or(`name_pt.ilike.%${q}%,name_en.ilike.%${q}%,id.ilike.%${q}%`)
        .order("tier", { nullsFirst: false })
        .order("enchant")
        .limit(12);
      if (alive) setHits((data ?? []) as Hit[]);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (selected) {
    return (
      <div className={cn(controlClass, "flex items-center gap-2 px-2")}>
        <input type="hidden" name={name} value={selected.id} />
        <ItemIcon id={selected.id} size={64} className="size-8" />
        <span className="min-w-0 flex-1 truncate">{selected.label}</span>
        <span className="hidden truncate font-mono text-[0.65rem] text-subtle sm:inline">{selected.id}</span>
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-label="Trocar item"
          className="text-subtle hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <div className={cn(controlClass, "flex items-center gap-2")}>
        <Search className="size-4 shrink-0 text-subtle" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar item (nome ou ID)"
          aria-label="Buscar item"
          className="h-full w-full bg-transparent focus:outline-none"
        />
      </div>
      {open && sanitize(query).length >= 2 && hits.length > 0 && (
        <ul className="glass-strong absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl p-1">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected({ id: h.id, label: label(h) });
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-white/[0.06]"
              >
                <ItemIcon id={h.id} size={64} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-sm">{label(h)}</span>
                <TierBadge tier={h.tier} enchant={h.enchant} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
