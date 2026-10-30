import { Coins, FlaskConical, Hammer, Scale, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackToCatalog } from "@/components/catalog/back-to-catalog";
import { ItemIcon } from "@/components/catalog/item-icon";
import { ItemPrices, type PriceRow, type StatRow } from "@/components/catalog/item-prices";
import { TierBadge } from "@/components/catalog/tier-badge";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { categoryLabel } from "@/lib/catalog/labels";
import { requestTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Item" };

type Params = Promise<{ id: string }>;

type Item = {
  id: string;
  name_pt: string | null;
  name_en: string | null;
  tier: number | null;
  enchant: number;
  kind: string;
  shop_category: string | null;
  shop_subcategory: string | null;
  crafting_category: string | null;
  weight: number | null;
};

type Recipe = { variant: number; silver: number; crafting_focus: number | null; amount_crafted: number };
type Ingredient = { variant: number; resource_id: string; count: number; max_return_amount: number | null };
type Brief = { id: string; name_pt: string | null; name_en: string | null; tier: number | null; enchant: number };

const name = (i: Brief | Item | undefined, fallback: string) => i?.name_pt ?? i?.name_en ?? fallback;

async function ItemDetail({ params }: { params: Params }) {
  const id = decodeURIComponent((await params).id);
  const supabase = await createClient();

  const [itemRes, recipesRes, ingredientsRes, usedInRes, pricesRes, statsRes, locsRes] = await Promise.all([
    supabase
      .from("items")
      .select("id, name_pt, name_en, tier, enchant, kind, shop_category, shop_subcategory, crafting_category, weight")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("recipes").select("variant, silver, crafting_focus, amount_crafted").eq("item_id", id).order("variant"),
    supabase.from("recipe_ingredients").select("variant, resource_id, count, max_return_amount").eq("item_id", id),
    supabase.from("recipe_ingredients").select("item_id").eq("resource_id", id).limit(200),
    supabase
      .from("price_latest")
      .select("location, quality, sell_min, sell_min_at, buy_max, buy_max_at, source")
      .eq("item_id", id),
    supabase
      .from("market_stats")
      .select("location, quality, volume_7d, volume_30d, price_7d, days_sold_30d")
      .eq("item_id", id),
    supabase.from("locations").select("id").eq("active", true).order("sort_order"),
  ]);
  const now = requestTime();

  const item = itemRes.data as Item | null;
  if (!item) notFound();

  const recipes = (recipesRes.data ?? []) as Recipe[];
  const ingredients = (ingredientsRes.data ?? []) as Ingredient[];
  const usedInIds = [...new Set(((usedInRes.data ?? []) as { item_id: string }[]).map((r) => r.item_id))].slice(0, 36);

  // Nomes dos ingredientes e dos itens que usam este.
  const lookupIds = [...new Set([...ingredients.map((g) => g.resource_id), ...usedInIds])];
  const { data: briefs } = lookupIds.length
    ? await supabase.from("items").select("id, name_pt, name_en, tier, enchant").in("id", lookupIds)
    : { data: [] };
  const byId = new Map(((briefs ?? []) as Brief[]).map((b) => [b.id, b]));

  return (
    <div className="space-y-4">
      <GlassCard neon className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="grid size-28 shrink-0 place-items-center self-center rounded-2xl bg-[radial-gradient(circle,rgb(139_92_246/0.28),transparent_70%)]">
          <ItemIcon id={item.id} size={128} className="size-28" alt={name(item, item.id)} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge tier={item.tier} enchant={item.enchant} />
            <span className="text-xs text-muted">{categoryLabel(item.shop_category)}</span>
            {item.shop_subcategory && <span className="text-xs text-subtle">· {item.shop_subcategory}</span>}
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-wide sm:text-2xl">{name(item, item.id)}</h2>
          {item.name_en && item.name_en !== item.name_pt && <p className="text-sm text-muted">{item.name_en}</p>}
          <p className="mt-1 font-mono text-xs text-subtle">{item.id}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:w-64">
          <Fact icon={<Scale className="size-3.5" />} label="Peso" value={item.weight != null ? `${item.weight} kg` : "—"} />
          <Fact icon={<Hammer className="size-3.5" />} label="Craft" value={item.crafting_category ?? "—"} />
        </dl>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <CardTitle
          icon={<Coins className="size-4" />}
          title="Preços por local"
          subtitle="Última leitura de cada mercado (Albion Data Project) e volume dos últimos 7 dias."
        />
        <ItemPrices
          prices={(pricesRes.data ?? []) as PriceRow[]}
          stats={(statsRes.data ?? []) as StatRow[]}
          locations={((locsRes.data ?? []) as { id: string }[]).map((l) => l.id)}
          now={now}
        />
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GlassCard className="p-5 sm:p-6">
          <CardTitle
            icon={<FlaskConical className="size-4" />}
            title="Receita"
            subtitle={recipes.length > 1 ? `${recipes.length} variantes de receita` : "Ingredientes para craftar"}
          />
          {recipes.length === 0 ? (
            <p className="mt-5 text-sm text-muted">Este item não é craftável.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {recipes.map((r) => (
                <div key={r.variant} className="rounded-xl border border-glass-border bg-white/[0.02] p-3.5">
                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    {recipes.length > 1 && <span className="font-mono text-violet-soft">Variante {r.variant + 1}</span>}
                    <span>
                      Rende <b className="text-foreground">{r.amount_crafted}</b>
                    </span>
                    {r.crafting_focus != null && (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="size-3 text-cyan" aria-hidden />
                        Foco <b className="font-mono text-foreground">{r.crafting_focus.toLocaleString("pt-BR")}</b>
                      </span>
                    )}
                    {r.silver > 0 && <span>Prata {r.silver.toLocaleString("pt-BR")}</span>}
                  </div>
                  <ul className="space-y-2">
                    {ingredients
                      .filter((g) => g.variant === r.variant)
                      .map((g) => {
                        const b = byId.get(g.resource_id);
                        return (
                          <li key={g.resource_id}>
                            <Link
                              href={`/catalogo/${encodeURIComponent(g.resource_id)}`}
                              className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-white/[0.04]"
                            >
                              <ItemIcon id={g.resource_id} size={64} className="size-10" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{name(b, g.resource_id)}</span>
                                <span className="block truncate font-mono text-[0.65rem] text-subtle">
                                  {g.resource_id}
                                  {g.max_return_amount === 0 && <span className="ml-2 text-amber-300">sem retorno</span>}
                                </span>
                              </span>
                              <span className="font-mono text-sm text-foreground">×{g.count}</span>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <CardTitle
            icon={<Hammer className="size-4" />}
            title="Usado em"
            subtitle={usedInIds.length ? "Itens que levam este como ingrediente" : undefined}
          />
          {usedInIds.length === 0 ? (
            <p className="mt-5 text-sm text-muted">Não é ingrediente de nenhuma receita.</p>
          ) : (
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {usedInIds.map((uid) => {
                const b = byId.get(uid);
                return (
                  <li key={uid}>
                    <Link
                      href={`/catalogo/${encodeURIComponent(uid)}`}
                      className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <ItemIcon id={uid} size={64} className="size-9" />
                      <span className="min-w-0 flex-1 truncate text-sm">{name(b, uid)}</span>
                      {b && <TierBadge tier={b.tier} enchant={b.enchant} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-glass-border bg-white/[0.02] p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm">{value}</dd>
    </div>
  );
}

export default function ItemPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackToCatalog />
      <Suspense fallback={<GlassCard className="h-48 animate-pulse" />}>
        <ItemDetail params={params} />
      </Suspense>
    </div>
  );
}
