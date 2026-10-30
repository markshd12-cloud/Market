import { Database, ShieldAlert, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CollectorPanel } from "@/components/admin/collector-panel";
import { ConstantRow, type GameConstant } from "@/components/admin/constant-row";
import { ImportPanel } from "@/components/admin/import-panel";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getCollectorStatus } from "@/lib/collector";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administração" };
// A importação baixa ~40 MB e grava ~50 mil linhas.
export const maxDuration = 60;

const CATEGORY_TITLES: Record<string, string> = {
  mercado: "Mercado",
  producao: "Produção",
  risco: "Risco",
  oportunidades: "Oportunidades",
  captura: "Captura",
  geral: "Geral",
};

async function AdminContent() {
  const user = await getCurrentUser();

  if (!user.isAdmin) {
    return (
      <GlassCard className="p-6">
        <CardTitle
          icon={<ShieldAlert className="size-4" />}
          title="Acesso restrito"
          subtitle="Esta área é só para administradores da plataforma."
        />
      </GlassCard>
    );
  }

  const supabase = await createClient();
  const [items, recipes, lastImport, constants, collector] = await Promise.all([
    supabase.from("items").select("id", { count: "exact", head: true }),
    supabase.from("recipes").select("item_id", { count: "exact", head: true }),
    supabase
      .from("catalog_imports")
      .select("created_at, source_ref, items")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("game_constants").select("*").order("category").order("key"),
    getCollectorStatus(),
  ]);

  const grouped = new Map<string, GameConstant[]>();
  for (const c of (constants.data ?? []) as GameConstant[]) {
    grouped.set(c.category, [...(grouped.get(c.category) ?? []), c]);
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-4">
      <GlassCard neon className="h-fit p-5 sm:p-6">
        <CardTitle
          icon={<Database className="size-4" />}
          title="Catálogo do jogo"
          subtitle="Itens, receitas e ingredientes do ao-bin-dumps (dados extraídos do cliente do jogo)."
        />
        <dl className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Itens" value={items.count} />
          <Stat label="Receitas" value={recipes.count} />
        </dl>
        <p className="mt-3 text-xs text-muted">
          {lastImport.data
            ? `Última importação: ${new Date(lastImport.data.created_at).toLocaleString("pt-BR")}${lastImport.data.source_ref ? ` · versão ${lastImport.data.source_ref}` : ""}`
            : "Nenhuma importação ainda."}
        </p>
        <div className="mt-5">
          <ImportPanel />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-subtle">
          Rode de novo após cada patch do jogo. Itens e receitas existentes são atualizados, nada é
          apagado.
        </p>
      </GlassCard>
      <CollectorPanel status={collector} />
      </div>

      <GlassCard className="p-5 sm:p-6">
        <CardTitle
          icon={<SlidersHorizontal className="size-4" />}
          title="Constantes do jogo"
          subtitle="Usadas em todos os cálculos. Cada alteração fica registrada no histórico."
        />
        <div className="mt-5 space-y-6">
          {[...grouped.entries()].map(([category, list]) => (
            <section key={category}>
              <h3 className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-subtle">
                {CATEGORY_TITLES[category] ?? category}
              </h3>
              <div className="space-y-2">
                {list.map((c) => (
                  <ConstantRow key={c.key} constant={c} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-glass-border bg-white/[0.02] p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold">{(value ?? 0).toLocaleString("pt-BR")}</dd>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">Conta</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">Administração</h1>
      </header>
      <Suspense fallback={<GlassCard className="h-64 animate-pulse" />}>
        <AdminContent />
      </Suspense>
    </div>
  );
}
