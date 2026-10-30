"use client";

import { ArrowRight, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { qualityLabel } from "@/lib/catalog/labels";
import { ageHours, silver, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PriceRow = {
  location: string;
  quality: number;
  sell_min: number | null;
  sell_min_at: string | null;
  buy_max: number | null;
  buy_max_at: string | null;
  /** 'capture' = veio do seu Data Client (captura própria). */
  source?: string;
};

export type StatRow = {
  location: string;
  quality: number;
  volume_7d: number;
  volume_30d: number;
  price_7d: number | null;
  days_sold_30d: number;
};

/** Cor pela idade do preço: verde < 1 h, normal < 6 h, âmbar < 24 h, apagado depois. */
function ageClass(hours: number) {
  if (hours < 1) return "text-emerald-300";
  if (hours < 6) return "text-foreground/70";
  if (hours < 24) return "text-amber-300";
  return "text-subtle line-through decoration-white/20";
}

/**
 * Tabela de preços por local. `now` vem do servidor para que "há X min" saia
 * igual no HTML e na hidratação.
 */
export function ItemPrices({
  prices,
  stats,
  locations,
  now,
}: {
  prices: PriceRow[];
  stats: StatRow[];
  locations: string[];
  now: number;
}) {
  const qualities = useMemo(
    () => [...new Set([...prices, ...stats].map((r) => r.quality))].sort((a, b) => a - b),
    [prices, stats],
  );
  const [quality, setQuality] = useState(qualities[0] ?? 1);

  const rows = locations.map((loc) => ({
    loc,
    price: prices.find((p) => p.location === loc && p.quality === quality),
    stat: stats.find((s) => s.location === loc && s.quality === quality),
  }));

  // Melhor diferença bruta: comprar no menor "venda mín." e vender na maior "compra máx." (antes de taxas).
  const fresh = (iso: string | null) => ageHours(iso, now) < 24;
  const cheapest = rows
    .filter((r) => r.price?.sell_min && fresh(r.price.sell_min_at))
    .sort((a, b) => a.price!.sell_min! - b.price!.sell_min!)[0];
  const bestBuy = rows
    .filter((r) => r.price?.buy_max && fresh(r.price.buy_max_at))
    .sort((a, b) => b.price!.buy_max! - a.price!.buy_max!)[0];
  const margin =
    cheapest && bestBuy && cheapest.loc !== bestBuy.loc
      ? (bestBuy.price!.buy_max! - cheapest.price!.sell_min!) / cheapest.price!.sell_min!
      : null;

  if (qualities.length === 0) {
    return <p className="mt-5 text-sm text-muted">Sem preços coletados ainda para este item.</p>;
  }

  return (
    <div className="mt-5 space-y-4">
      {qualities.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Qualidade">
          {qualities.map((q) => (
            <button
              key={q}
              role="tab"
              aria-selected={q === quality}
              onClick={() => setQuality(q)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                q === quality
                  ? "border-violet/50 bg-violet/15 text-violet-soft"
                  : "border-glass-border text-muted hover:text-foreground",
              )}
            >
              {qualityLabel(q)}
            </button>
          ))}
        </div>
      )}

      {margin !== null && margin > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm">
          <TrendingUp className="size-4 text-emerald-300" aria-hidden />
          <span className="text-muted">Comprar em</span>
          <b>{cheapest!.loc}</b>
          <span className="font-mono">{silver(cheapest!.price!.sell_min)}</span>
          <ArrowRight className="size-3.5 text-muted" aria-hidden />
          <span className="text-muted">vender para ordem em</span>
          <b>{bestBuy!.loc}</b>
          <span className="font-mono">{silver(bestBuy!.price!.buy_max)}</span>
          <span className="ml-auto font-mono font-semibold text-emerald-300">
            +{(margin * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% bruto
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-glass-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-white/[0.03] text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Local</th>
              <th className="px-3 py-2.5 text-right font-medium">Venda mín.</th>
              <th className="px-3 py-2.5 text-right font-medium">Compra máx.</th>
              <th className="px-3 py-2.5 text-right font-medium" title="Média de itens vendidos por dia (7 dias)">
                Vendidos/dia
              </th>
              <th className="px-3 py-2.5 text-right font-medium" title="Preço médio ponderado (7 dias)">
                Médio 7d
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ loc, price, stat }) => (
              <tr key={loc} className="border-t border-glass-border/70">
                <td className="px-3 py-2.5">
                  {loc}
                  {price?.source === "capture" && (
                    <span
                      title="Preço da captura própria (seu Data Client)"
                      className="ml-2 rounded border border-cyan/40 bg-cyan/10 px-1 py-px text-[0.6rem] text-cyan"
                    >
                      captura
                    </span>
                  )}
                </td>
                <PriceCell
                  value={price?.sell_min}
                  at={price?.sell_min_at}
                  now={now}
                  highlight={cheapest?.loc === loc && margin !== null}
                />
                <PriceCell
                  value={price?.buy_max}
                  at={price?.buy_max_at}
                  now={now}
                  highlight={bestBuy?.loc === loc && margin !== null}
                />
                <td className="px-3 py-2.5 text-right font-mono">
                  {stat ? stat.volume_7d.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{silver(stat?.price_7d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-subtle">
        Idade do preço: <span className="text-emerald-300">verde</span> &lt; 1 h ·{" "}
        <span className="text-amber-300">âmbar</span> &lt; 24 h · riscado = mais velho que 24 h. Diferença bruta,
        antes de taxas e transporte.
      </p>
    </div>
  );
}

function PriceCell({
  value,
  at,
  now,
  highlight,
}: {
  value: number | null | undefined;
  at: string | null | undefined;
  now: number;
  highlight: boolean;
}) {
  if (!value) return <td className="px-3 py-2.5 text-right text-subtle">—</td>;
  return (
    <td className={cn("px-3 py-2.5 text-right", highlight && "bg-success/10")}>
      <span className="block font-mono">{silver(value)}</span>
      <span className={cn("block text-[0.65rem]", ageClass(ageHours(at, now)))}>{timeAgo(at, now)}</span>
    </td>
  );
}
