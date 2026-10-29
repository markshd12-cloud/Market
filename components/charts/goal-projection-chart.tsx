"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatSilver } from "@/lib/utils";

import { GlassTooltip } from "./chart-tooltip";

export type Scenario = { key: string; label: string; dailyRate: number; color: string };

/**
 * Projeção da meta com juros compostos diários (tudo reinvestido).
 * Os cenários vêm como parâmetro: nada fixo no gráfico.
 */
export function GoalProjectionChart({
  start,
  goal,
  days,
  scenarios,
}: {
  start: number;
  goal: number;
  days: number;
  scenarios: Scenario[];
}) {
  const data = useMemo(
    () =>
      Array.from({ length: days + 1 }, (_, day) => {
        const row: Record<string, number> = { day };
        for (const s of scenarios) row[s.key] = Math.round(start * (1 + s.dailyRate) ** day);
        return row;
      }),
    [start, days, scenarios],
  );

  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
          <defs>
            {scenarios.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="rgb(255 255 255 / 0.06)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(d) => `D${d}`}
            tick={{ fill: "#8d8aab", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v) => formatSilver(v)}
            tick={{ fill: "#8d8aab", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <ReferenceLine
            y={goal}
            stroke="#e879f9"
            strokeDasharray="6 6"
            strokeOpacity={0.7}
            label={{ value: `Meta ${formatSilver(goal)}`, fill: "#f0abfc", fontSize: 11, position: "insideTopLeft" }}
          />
          <Tooltip
            cursor={{ stroke: "rgb(167 139 250 / 0.4)", strokeWidth: 1 }}
            content={<GlassTooltip labelFormatter={(d) => `Dia ${d}`} />}
          />
          {scenarios.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#fill-${s.key})`}
              activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
