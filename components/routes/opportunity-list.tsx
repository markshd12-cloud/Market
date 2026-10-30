import { ArrowRight, ClipboardPlus, Compass, ShieldAlert, TrendingUp } from "lucide-react";
import Link from "next/link";

import { ItemIcon } from "@/components/catalog/item-icon";
import { TierBadge } from "@/components/catalog/tier-badge";
import { GlassCard } from "@/components/ui/card";
import { qualityLabel } from "@/lib/catalog/labels";
import { ageHours, requestTime, silver, timeAgo } from "@/lib/format";
import {
  FLAG_LABELS,
  MODE_LABELS,
  rpcParams,
  type Opportunity,
  type OpportunityMode,
  type RouteFixed,
  type RouteSearchParams,
} from "@/lib/opportunities";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const pct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Verde ≥ 70, âmbar ≥ 40, vermelho abaixo. */
function confidenceClass(c: number) {
  if (c >= 70) return "border-success/40 bg-success/10 text-emerald-300";
  if (c >= 40) return "border-amber-400/40 bg-amber-400/10 text-amber-300";
  return "border-rose-400/40 bg-rose-400/10 text-rose-300";
}

const toneClass = {
  danger: "border-rose-400/30 text-rose-300",
  warn: "border-amber-400/30 text-amber-300",
  info: "border-glass-border text-muted",
  capture: "border-cyan/40 bg-cyan/10 text-cyan",
};

/** Busca as rotas no banco (RPC) e mostra a lista. Precisa estar dentro de <Suspense>. */
export async function OpportunityList({
  searchParams,
  fixed = {},
}: {
  searchParams: Promise<RouteSearchParams>;
  fixed?: RouteFixed;
}) {
  const params = rpcParams(await searchParams, fixed);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("market_opportunities", params);
  const now = requestTime();

  if (error) {
    return (
      <GlassCard className="p-6 text-sm text-rose-300">
        Não foi possível calcular as rotas. {error.code === "PGRST202" && "Falta aplicar a migration mais recente (0010)."}
      </GlassCard>
    );
  }

  const rows = (data ?? []) as Opportunity[];

  if (rows.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-3 p-10 text-center">
        <Compass className="size-8 text-violet-soft" aria-hidden />
        <p className="font-medium">
          {fixed.mine ? "Nenhuma rota com os itens que você capturou." : "Nenhuma rota passa nos filtros agora."}
        </p>
        <p className="max-w-sm text-sm text-muted">
          {fixed.mine
            ? "Aumente a janela, baixe a confiança mínima ou capture mais páginas no jogo (venda e compra, em mais de uma cidade)."
            : "Tente outra cidade ou categoria, ou baixe a confiança mínima. Os preços se renovam a cada 5 minutos."}
        </p>
      </GlassCard>
    );
  }

  const best = rows.reduce((a, b) => (b.profit_total > a.profit_total ? b : a));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span>
          <b className="text-foreground">{rows.length}</b> {rows.length === 1 ? "rota" : "rotas"} ·{" "}
          {MODE_LABELS[params.p_mode]}
        </span>
        <span>
          Melhor: <b className="font-mono text-emerald-300">+{silver(best.profit_total)}</b> em {best.name}
        </span>
      </div>

      <ul className="space-y-2.5">
        {rows.map((o) => (
          <li key={`${o.item_id}:${o.quality}:${o.origin}:${o.dest}`}>
            <OpportunityRow o={o} now={now} mode={params.p_mode} />
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-subtle">
        Lucro estimado = (venda − taxas − compra) × quantidade, já com a folga de segurança. Quantidade = o menor
        entre o capital por rotação e a parte do volume diário que a origem e o destino aguentam. Taxas e limites
        ficam em Administração → Constantes (ainda “a confirmar”). Sempre confira o preço no jogo antes de comprar.
      </p>
    </div>
  );
}

/** Leva a rota para o formulário de operação, já preenchido. */
function registerHref(o: Opportunity, mode: OpportunityMode) {
  const q = new URLSearchParams({
    item: o.item_id,
    nome: o.name,
    q: String(o.quality),
    qtd: String(o.qty),
    de: o.origin,
    para: o.dest,
    compra: String(o.buy_price),
    modo: mode,
    prev: String(o.profit_total),
  });
  return `/operacoes?${q.toString()}`;
}

function OpportunityRow({ o, now, mode }: { o: Opportunity; now: number; mode: OpportunityMode }) {
  return (
    <GlassCard className="grid grid-cols-1 gap-4 p-4 transition-colors hover:border-violet/30 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] lg:items-center">
      <Link href={`/catalogo/${encodeURIComponent(o.item_id)}`} className="group flex min-w-0 items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[radial-gradient(circle,rgb(139_92_246/0.18),transparent_70%)]">
          <ItemIcon id={o.item_id} size={64} className="size-14" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium group-hover:text-violet-soft">{o.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <TierBadge tier={o.tier} enchant={o.enchant} />
            <span className="text-[0.7rem] text-muted">{qualityLabel(o.quality)}</span>
            {o.weight != null && <span className="text-[0.7rem] text-subtle">· {o.weight} kg</span>}
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <Leg place={o.origin} label="compra" price={o.buy_price} at={o.buy_at} now={now} />
        <ArrowRight className="size-4 shrink-0 text-violet-soft" aria-hidden />
        <Leg place={o.dest} label="venda" price={o.sell_price} at={o.sell_at} now={now} />
      </div>

      <div className="space-y-2">
        <dl className="grid grid-cols-4 gap-2 text-right">
          <Metric label="Lucro/un." value={silver(o.profit_unit)} title={`Taxas: ${silver(o.fees_unit)} por unidade`} />
          <Metric label="Margem" value={pct(o.margin)} />
          <Metric
            label="Qtd."
            value={o.qty.toLocaleString("pt-BR")}
            title={o.volume_7d != null ? `Destino vende ~${silver(o.volume_7d)}/dia` : "Sem histórico de volume"}
          />
          <Metric label="Estimado" value={`+${silver(o.profit_total)}`} strong />
        </dl>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {o.flags.map((f) => {
            const meta = FLAG_LABELS[f];
            if (!meta) return null;
            return (
              <span
                key={f}
                title={meta.hint}
                className={cn("rounded-md border px-1.5 py-0.5 text-[0.65rem]", toneClass[meta.tone])}
              >
                {f === "zona_vermelha" && <ShieldAlert className="mr-1 inline size-3 align-[-2px]" aria-hidden />}
                {meta.label}
              </span>
            );
          })}
          <span
            title="Idade do dado, recorrência de venda no destino e distância da média de 7 dias"
            className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[0.65rem]", confidenceClass(o.confidence))}
          >
            <TrendingUp className="mr-1 inline size-3 align-[-2px]" aria-hidden />
            {o.confidence}
          </span>
          <Link
            href={registerHref(o, mode)}
            title="Registrar esta compra em Operações"
            className="inline-flex items-center gap-1 rounded-md border border-violet/40 bg-violet/10 px-1.5 py-0.5 text-[0.65rem] text-violet-soft hover:bg-violet/20"
          >
            <ClipboardPlus className="size-3" aria-hidden />
            Registrar
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}

function Leg({
  place,
  label,
  price,
  at,
  now,
}: {
  place: string;
  label: string;
  price: number;
  at: string;
  now: number;
}) {
  const hours = ageHours(at, now);
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-glass-border bg-white/[0.02] px-3 py-2">
      <p className="truncate text-xs text-muted">
        {label} · <span className="text-foreground">{place}</span>
      </p>
      <p className="font-mono text-sm">{silver(price)}</p>
      <p className={cn("text-[0.65rem]", hours < 1 ? "text-emerald-300" : hours < 3 ? "text-muted" : "text-amber-300")}>
        {timeAgo(at, now)}
      </p>
    </div>
  );
}

function Metric({ label, value, strong, title }: { label: string; value: string; strong?: boolean; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="text-[0.65rem] text-muted">{label}</dt>
      <dd className={cn("truncate font-mono text-sm", strong && "font-semibold text-emerald-300")}>{value}</dd>
    </div>
  );
}
