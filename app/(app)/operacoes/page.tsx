import { ArrowRight, History, Landmark, PackageOpen, Plus, Scale, Target, Trash2, Undo2, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ItemIcon } from "@/components/catalog/item-icon";
import { TierBadge } from "@/components/catalog/tier-badge";
import { Kpi } from "@/components/dashboard/dashboard-content";
import {
  BalanceForm,
  CharacterSwitcher,
  CloseOperationForm,
  NewOperationForm,
  type OperationPrefill,
} from "@/components/operations/operation-forms";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { qualityLabel } from "@/lib/catalog/labels";
import {
  getBank,
  getCharacters,
  itemName,
  OPERATION_FIELDS,
  pickCharacter,
  type Operation,
} from "@/lib/finance";
import { requestTime, silver, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn, formatSilver } from "@/lib/utils";

import { deleteOperation, reopenOperation } from "./actions";

export const metadata: Metadata = { title: "Operações" };

type SearchParams = Promise<{
  p?: string;
  item?: string;
  nome?: string;
  q?: string;
  qtd?: string;
  de?: string;
  para?: string;
  compra?: string;
  modo?: string;
  prev?: string;
}>;

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${formatSilver(Math.abs(n))}`;

async function OperationsContent({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const characters = await getCharacters();
  const character = pickCharacter(characters, sp.p);

  if (!character) {
    return (
      <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
        <Wallet className="size-8 text-violet-soft" aria-hidden />
        <p className="font-medium">Crie um personagem para registrar operações.</p>
        <p className="max-w-sm text-sm text-muted">Cada personagem tem banco, meta e histórico próprios.</p>
        <Link
          href="/personagens"
          className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet/40 bg-violet/15 px-4 text-sm text-violet-soft hover:bg-violet/25"
        >
          <Plus className="size-4" /> Criar personagem
        </Link>
      </GlassCard>
    );
  }

  const supabase = await createClient();
  const [bank, { data: openData }, { data: closedData }, { data: locs }] = await Promise.all([
    getBank(character.id),
    supabase
      .from("operations")
      .select(OPERATION_FIELDS)
      .eq("character_id", character.id)
      .eq("status", "aberta")
      .order("opened_at", { ascending: false }),
    supabase
      .from("operations")
      .select(OPERATION_FIELDS)
      .eq("character_id", character.id)
      .neq("status", "aberta")
      .order("closed_at", { ascending: false })
      .limit(500),
    supabase.from("locations").select("id").eq("active", true).order("sort_order"),
  ]);
  const now = requestTime();
  const locations = ((locs ?? []) as { id: string }[]).map((l) => l.id);
  const open = (openData ?? []) as unknown as Operation[];
  const closed = (closedData ?? []) as unknown as Operation[];

  // KPIs do histórico (últimas 500 fechadas).
  const realized = closed.reduce((s, o) => s + (o.profit ?? 0), 0);
  const withPlan = closed.filter((o) => o.expected_profit != null);
  const planned = withPlan.reduce((s, o) => s + (o.expected_profit ?? 0), 0);
  const plannedRealized = withPlan.reduce((s, o) => s + (o.profit ?? 0), 0);
  const hitRate = planned > 0 ? plannedRealized / planned : null;
  const wins = closed.filter((o) => (o.profit ?? 0) > 0).length;

  const prefill: OperationPrefill | undefined = sp.item
    ? {
        item: sp.item,
        itemLabel: sp.nome ?? sp.item,
        quality: sp.q,
        quantity: sp.qtd,
        buyLocation: sp.de,
        buyPrice: sp.compra,
        sellLocation: sp.para,
        saleMode: sp.modo,
        expected: sp.prev,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Personagem <b className="text-foreground">{character.name}</b>
          {character.premium ? " · premium" : " · sem premium"}
        </p>
        <CharacterSwitcher characters={characters} current={character.id} />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Landmark className="size-4" />}
          label="Banco atual"
          value={bank.current != null ? formatSilver(bank.current) : "—"}
          hint={
            bank.snapshot
              ? `informado ${timeAgo(bank.snapshot.taken_at, now)} ${signed(bank.profitSinceSnapshot)} desde então`
              : "informe o banco ao lado"
          }
          muted={bank.current == null}
        />
        <Kpi
          icon={<Wallet className="size-4" />}
          label="Lucro realizado"
          value={closed.length ? signed(realized) : "—"}
          hint={closed.length ? `${closed.length} fechadas · ${wins} no lucro` : "nenhuma operação fechada"}
          muted={!closed.length}
        />
        <Kpi
          icon={<Target className="size-4" />}
          label="Previsto × realizado"
          value={hitRate != null ? `${Math.round(hitRate * 100)}%` : "—"}
          hint={
            hitRate != null
              ? `${formatSilver(plannedRealized)} de ${formatSilver(planned)} previstos`
              : "registre a partir das rotas"
          }
          muted={hitRate == null}
        />
        <Kpi
          icon={<PackageOpen className="size-4" />}
          label="Em operações abertas"
          value={open.length ? formatSilver(bank.inOpenOperations) : "—"}
          hint={`${open.length} ${open.length === 1 ? "operação" : "operações"} aguardando venda`}
          muted={!open.length}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GlassCard neon={Boolean(prefill)} className="p-5 sm:p-6 xl:col-span-2">
          <CardTitle
            icon={<Plus className="size-4" />}
            title="Registrar compra"
            subtitle={prefill ? "Preenchido a partir da rota. Ajuste ao que você pagou de fato." : "O que você comprou para revender."}
          />
          <div className="mt-5">
            <NewOperationForm
              key={prefill ? `${prefill.item}:${prefill.buyLocation}:${prefill.sellLocation}` : "manual"}
              characterId={character.id}
              locations={locations}
              prefill={prefill}
            />
          </div>
        </GlassCard>
        <GlassCard className="p-5 sm:p-6">
          <CardTitle
            icon={<Landmark className="size-4" />}
            title="Banco"
            subtitle="O jogo não informa o saldo: anote de vez em quando. O lucro das vendas soma em cima."
          />
          <div className="mt-5">
            <BalanceForm characterId={character.id} />
          </div>
        </GlassCard>
      </section>

      <GlassCard className="p-5 sm:p-6">
        <CardTitle
          icon={<Scale className="size-4" />}
          title="Abertas"
          subtitle={open.length ? "Compradas e ainda não vendidas." : "Nada aguardando venda."}
        />
        {open.length > 0 && (
          <ul className="mt-5 space-y-3">
            {open.map((o) => (
              <li
                key={o.id}
                className="grid grid-cols-1 gap-4 rounded-xl border border-glass-border bg-white/[0.02] p-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ItemIcon id={o.item_id} size={64} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{itemName(o)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted">
                      {o.items && <TierBadge tier={o.items.tier} enchant={o.items.enchant} />}
                      {qualityLabel(o.quality)} · {o.quantity.toLocaleString("pt-BR")} × {silver(o.buy_price)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-subtle">
                      {o.buy_location ?? "?"} <ArrowRight className="size-3" /> {o.sell_location ?? "?"} · comprado{" "}
                      {timeAgo(o.opened_at, now)}
                      {o.expected_profit != null && ` · previsto ${signed(o.expected_profit)}`}
                    </p>
                    {o.note && <p className="mt-1 text-[0.7rem] italic text-subtle">{o.note}</p>}
                    <form action={deleteOperation} className="mt-2">
                      <input type="hidden" name="id" value={o.id} />
                      <button className="inline-flex items-center gap-1 text-[0.7rem] text-subtle hover:text-rose-300">
                        <Trash2 className="size-3" /> Apagar lançamento
                      </button>
                    </form>
                  </div>
                </div>
                <CloseOperationForm
                  id={o.id}
                  locations={locations}
                  defaultLocation={o.sell_location}
                  defaultMode={o.sale_mode}
                />
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <CardTitle
          icon={<History className="size-4" />}
          title="Histórico"
          subtitle={closed.length ? "Operações fechadas, da mais recente." : "Nenhuma operação fechada ainda."}
        />
        {closed.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-glass-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Item</th>
                  <th className="px-3 py-2.5 font-medium">Rota</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qtd.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Compra</th>
                  <th className="px-3 py-2.5 text-right font-medium">Venda</th>
                  <th className="px-3 py-2.5 text-right font-medium">Taxas</th>
                  <th className="px-3 py-2.5 text-right font-medium">Previsto</th>
                  <th className="px-3 py-2.5 text-right font-medium">Realizado</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {closed.slice(0, 50).map((o) => (
                  <tr key={o.id} className="border-t border-glass-border/70">
                    <td className="max-w-56 px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <ItemIcon id={o.item_id} size={64} className="size-8" />
                        <span className="min-w-0">
                          <span className="block truncate">{itemName(o)}</span>
                          <span className="block text-[0.65rem] text-subtle">{timeAgo(o.closed_at, now)}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {o.buy_location ?? "?"} → {o.sell_location ?? "?"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{o.quantity.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{silver(o.buy_price)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {o.status === "perdida" ? <span className="text-rose-300">perdida</span> : silver(o.sell_price)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted">{silver(o.fees)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted">
                      {o.expected_profit != null ? signed(o.expected_profit) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-mono font-semibold",
                        (o.profit ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300",
                      )}
                    >
                      {signed(o.profit ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <form action={reopenOperation}>
                        <input type="hidden" name="id" value={o.id} />
                        <button title="Reabrir (lançou errado)" className="text-subtle hover:text-foreground">
                          <Undo2 className="size-3.5" />
                          <span className="sr-only">Reabrir</span>
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default function OperationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">Finanças</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">Operações</h1>
        <p className="mt-1 text-sm text-muted">Compras, vendas e perdas: o que o motor previu e o que aconteceu.</p>
      </header>
      <Suspense fallback={<GlassCard className="h-96 animate-pulse" />}>
        <OperationsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
