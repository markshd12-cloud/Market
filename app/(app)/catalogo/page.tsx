import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ItemIcon } from "@/components/catalog/item-icon";
import { TierBadge } from "@/components/catalog/tier-badge";
import { GlassCard } from "@/components/ui/card";
import { categoryLabel } from "@/lib/catalog/labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Catálogo" };

const PAGE_SIZE = 48;

type SearchParams = Promise<{ q?: string; cat?: string; tier?: string; ench?: string; p?: string }>;

type ListItem = {
  id: string;
  name_pt: string | null;
  name_en: string | null;
  tier: number | null;
  enchant: number;
  shop_category: string | null;
};

/** Remove o que tem significado especial no filtro `or` do PostgREST. */
const sanitize = (s: string) => s.replace(/[,()%*\\]/g, " ").trim().slice(0, 60);

async function CatalogResults({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const search = sanitize(sp.q ?? "");
  const page = Math.max(1, Number(sp.p) || 1);
  const tier = Number(sp.tier);
  const ench = Number(sp.ench);

  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("id, name_pt, name_en, tier, enchant, shop_category", { count: "exact" });

  if (search) query = query.or(`name_pt.ilike.%${search}%,name_en.ilike.%${search}%,id.ilike.%${search}%`);
  if (sp.cat) query = query.eq("shop_category", sp.cat);
  if (sp.tier && Number.isInteger(tier)) query = query.eq("tier", tier);
  if (sp.ench && Number.isInteger(ench)) query = query.eq("enchant", ench);

  const { data, count, error } = await query
    .order("tier", { ascending: true, nullsFirst: false })
    .order("enchant")
    .order("name_pt")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (error) {
    return <p className="text-sm text-rose-300">Não foi possível carregar o catálogo.</p>;
  }

  const items = (data ?? []) as ListItem[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(search || sp.cat || sp.tier || sp.ench);

  if (total === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
        <PackageSearch className="size-8 text-violet-soft" aria-hidden />
        <p className="font-medium">{hasFilters ? "Nenhum item encontrado." : "O catálogo ainda está vazio."}</p>
        <p className="max-w-sm text-sm text-muted">
          {hasFilters
            ? "Tente outro nome, ou tire algum filtro."
            : "Um administrador precisa importar os itens em Administração."}
        </p>
      </GlassCard>
    );
  }

  const pageHref = (p: number) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    next.set("p", String(p));
    return `/catalogo?${next.toString()}`;
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        {total.toLocaleString("pt-BR")} {total === 1 ? "item" : "itens"}
      </p>

      <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/catalogo/${encodeURIComponent(item.id)}`}
              className="glass group flex items-center gap-3 rounded-2xl p-3 transition-colors hover:border-violet/40 hover:bg-white/[0.05]"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[radial-gradient(circle,rgb(139_92_246/0.18),transparent_70%)]">
                <ItemIcon id={item.id} size={64} className="size-14" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium group-hover:text-foreground">
                  {item.name_pt ?? item.name_en ?? item.id}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[0.65rem] text-subtle">{item.id}</span>
                <span className="mt-1.5 flex items-center gap-1.5">
                  <TierBadge tier={item.tier} enchant={item.enchant} />
                  <span className="truncate text-[0.7rem] text-muted">{categoryLabel(item.shop_category)}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Páginas">
          <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Anterior">
            <ChevronLeft className="size-4" />
          </PageLink>
          <span className="px-3 font-mono text-xs text-muted">
            {page} / {pages}
          </span>
          <PageLink href={pageHref(page + 1)} disabled={page >= pages} label="Próxima">
            <ChevronRight className="size-4" />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls = "glass grid size-10 place-items-center rounded-xl";
  if (disabled)
    return (
      <span className={cn(cls, "opacity-40")} aria-disabled>
        {children}
      </span>
    );
  return (
    <Link href={href} className={cn(cls, "hover:border-violet/40")} aria-label={label} scroll={false}>
      {children}
    </Link>
  );
}

function ResultsSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => (
        <li key={i} className="glass h-20 animate-pulse rounded-2xl" />
      ))}
    </ul>
  );
}

export default function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">Mercado</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">Catálogo</h1>
        <p className="mt-1 text-sm text-muted">Todos os itens do jogo, com receitas e ingredientes.</p>
      </header>

      <Suspense fallback={<div className="glass h-[68px] rounded-2xl" />}>
        <CatalogFilters />
      </Suspense>

      <Suspense fallback={<ResultsSkeleton />}>
        <CatalogResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
