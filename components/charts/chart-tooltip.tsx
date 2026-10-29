"use client";

import { formatSilver } from "@/lib/utils";

type Entry = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number };

/** Tooltip de vidro padrão dos gráficos (Recharts `content`). */
export function GlassTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = (v) => formatSilver(v),
}: {
  active?: boolean;
  payload?: readonly Entry[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-strong min-w-44 rounded-xl px-3.5 py-3 text-xs">
      {label !== undefined && (
        <p className="mb-2 font-mono uppercase tracking-wider text-muted">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <ul className="space-y-1.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-foreground/80">
              <span className="size-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="font-mono font-medium text-foreground">
              {typeof entry.value === "number" ? valueFormatter(entry.value) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
