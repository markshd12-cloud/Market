import { Gauge, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cache } from "react";

import { ProjectionChart } from "@/components/charts/projection-chart";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { getCharacters } from "@/lib/finance";
import { deterministic, monteCarlo, PRESETS, type Scenario } from "@/lib/projection";
import { getProjectionInput, goalOf } from "@/lib/projection-data";
import { formatSilver } from "@/lib/utils";

import { Kpi } from "./dashboard-content";

/** Personagem principal + projeção, uma vez por request (KPIs e gráfico usam o mesmo). */
const loadPlan = cache(async () => {
  const [main] = await getCharacters().catch(() => []);
  const goal = goalOf(main ?? null);
  if (!main) return { main: null, goal, start: 0, scenarios: [] as Scenario[] };

  const input = await getProjectionInput(main);
  const scenarios = input.scenarios.length
    ? input.scenarios.slice(0, 3)
    : PRESETS.map((p, i) => ({ ...p, key: `preset-${i}` }));
  if (input.history) scenarios.push(input.history);
  return { main, goal, start: input.start, scenarios };
});

/** Meta e ritmo diário necessário para chegar lá a partir do banco atual. */
export async function GoalKpis() {
  const { main, goal, start } = await loadPlan();
  const base = start || 20_000_000;
  const rate = goal.amount > base ? (goal.amount / base) ** (1 / goal.days) - 1 : 0;

  return (
    <>
      <Kpi
        icon={<Target className="size-4" />}
        label="Meta"
        value={formatSilver(goal.amount)}
        hint={main && goal.fromCharacter ? `${main.name} · em ${goal.days} dias` : `padrão · em ${goal.days} dias`}
      />
      <Kpi
        icon={<Gauge className="size-4" />}
        label="Ritmo necessário"
        value={`${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
        hint={`por dia, partindo de ${formatSilver(base)}${start ? "" : " (estimado)"}`}
      />
    </>
  );
}

export async function ProjectionCard() {
  const { goal, start, scenarios } = await loadPlan();
  const base = start || 20_000_000;
  const results = scenarios.map((s) => ({
    s,
    path: deterministic(base, goal.days, s),
    hit: monteCarlo(base, goal.days, goal.amount, s, 800).hitChance,
  }));

  return (
    <GlassCard neon className="h-full p-5 sm:p-6">
      <CardTitle
        icon={<TrendingUp className="size-4" />}
        title="Projeção da meta"
        subtitle={start ? "A partir do seu banco atual. Passe o mouse para ver cada dia." : "Banco estimado em 20M: informe o seu em Operações."}
        action={
          <Link href="/projecoes" className="text-xs text-violet-soft hover:underline">
            Abrir projeções
          </Link>
        }
      />
      <div className="mt-5">
        <ProjectionChart
          goal={goal.amount}
          series={results.map((r) => ({ key: r.s.key, name: r.s.name, color: r.s.color, values: r.path }))}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {results.map(({ s, hit }) => (
          <div key={s.key} className="rounded-xl border border-glass-border bg-white/[0.02] p-3">
            <p className="flex items-center gap-2 truncate text-xs text-muted">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              {s.name}
            </p>
            <p className="mt-1 font-mono text-sm">
              {Math.round(hit * 100)}% <span className="text-muted">de chance</span>
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export function GoalKpisSkeleton() {
  return (
    <>
      <Kpi icon={<Target className="size-4" />} label="Meta" value="…" hint="carregando" muted />
      <Kpi icon={<Gauge className="size-4" />} label="Ritmo necessário" value="…" hint="carregando" muted />
    </>
  );
}
