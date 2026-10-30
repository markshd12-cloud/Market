"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatSilver } from "@/lib/utils";

import { GlassTooltip } from "./chart-tooltip";

export type ProjectionSeries = { key: string; name: string; color: string; values: number[] };
export type ProjectionBand = { name: string; color: string; low: number[]; high: number[] };

/**
 * Banco projetado por dia: uma linha por cenário e, opcionalmente, a faixa
 * provável (p10–p90 do Monte Carlo) de um deles.
 */
export function ProjectionChart({
  series,
  band,
  goal,
  className = "h-72 w-full sm:h-80",
}: {
  series: ProjectionSeries[];
  band?: ProjectionBand | null;
  goal: number;
  className?: string;
}) {
  const days = Math.max(0, ...series.map((s) => s.values.length - 1), band ? band.low.length - 1 : 0);
  const data = useMemo(
    () =>
      Array.from({ length: days + 1 }, (_, day) => {
        const row: Record<string, number | number[]> = { day };
        for (const s of series) if (s.values[day] != null) row[s.key] = s.values[day];
        if (band) row.band = [band.low[day], band.high[day]];
        return row;
      }),
    [days, series, band],
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
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
          {band && (
            <Area
              type="monotone"
              dataKey="band"
              name={band.name}
              stroke="none"
              fill={band.color}
              fillOpacity={0.14}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
