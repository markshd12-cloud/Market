import { CircleDashed, CircleDot, Gauge, Radio, Target, TrendingUp, Wallet } from "lucide-react";

import { GoalProjectionChart, type Scenario } from "@/components/charts/goal-projection-chart";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { cn, formatSilver } from "@/lib/utils";

// Premissas do plano (docs 05 e 09). Viram configuração por personagem na etapa 6.
const PLAN = { start: 20_000_000, goal: 100_000_000, days: 20 };
const SCENARIOS: Scenario[] = [
  { key: "pess", label: "8% / dia", dailyRate: 0.08, color: "#22d3ee" },
  { key: "base", label: "10% / dia", dailyRate: 0.1, color: "#a78bfa" },
  { key: "otim", label: "12% / dia", dailyRate: 0.12, color: "#34d399" },
];

const requiredRate = (PLAN.goal / PLAN.start) ** (1 / PLAN.days) - 1;
const daysToGoal = (rate: number) => Math.ceil(Math.log(PLAN.goal / PLAN.start) / Math.log(1 + rate));

const ROADMAP = [
  { step: "Base do site e login", status: "now" },
  { step: "Catálogo de itens e constantes", status: "next" },
  { step: "Coletor de preços (Supabase)", status: "next" },
  { step: "Motor de rotas e Black Market", status: "next" },
  { step: "Perfil, operações e meta", status: "next" },
  { step: "Projeções e cenários", status: "next" },
] as const;

/** Corpo do dashboard. A saudação chega pronta (o page.tsx a envolve em <Suspense>). */
export function DashboardContent({ greeting }: { greeting: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">Visão geral</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">
            Boa caçada,{" "}
            {greeting}
          </h1>
        </div>
        <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-xs text-muted">
          <span className="size-1.5 rounded-full bg-cyan shadow-[0_0_10px_2px_rgb(34_211_238/0.7)]" />
          Albion West
        </span>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Target className="size-4" />} label="Meta" value={formatSilver(PLAN.goal)} hint={`em ${PLAN.days} dias`} />
        <Kpi
          icon={<Gauge className="size-4" />}
          label="Ritmo necessário"
          value={`${(requiredRate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
          hint={`por dia, partindo de ${formatSilver(PLAN.start)}`}
        />
        <Kpi icon={<Wallet className="size-4" />} label="Banco atual" value="—" hint="registro de operações na etapa 5" muted />
        <Kpi icon={<Radio className="size-4" />} label="Coletor" value="Offline" hint="liga na etapa 3" muted />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GlassCard neon className="p-5 sm:p-6 xl:col-span-2">
          <CardTitle
            icon={<TrendingUp className="size-4" />}
            title="Projeção da meta"
            subtitle="Simulação com juros compostos diários, sem perdas. Passe o mouse para ver cada dia."
          />
          <div className="mt-5">
            <GoalProjectionChart start={PLAN.start} goal={PLAN.goal} days={PLAN.days} scenarios={SCENARIOS} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {SCENARIOS.map((s) => (
              <div key={s.key} className="rounded-xl border border-glass-border bg-white/[0.02] p-3">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </p>
                <p className="mt-1 font-mono text-sm">
                  {daysToGoal(s.dailyRate)} <span className="text-muted">dias</span>
                </p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <CardTitle icon={<CircleDot className="size-4" />} title="Construção" subtitle="Marco 1 · alertas de rota" />
          <ol className="mt-5 space-y-3">
            {ROADMAP.map(({ step, status }, i) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg border font-mono text-[0.65rem]",
                    status === "now"
                      ? "border-violet/50 bg-violet/15 text-violet-soft shadow-[0_0_14px_-2px_rgb(139_92_246/0.7)]"
                      : "border-glass-border text-subtle",
                  )}
                >
                  {status === "now" ? <CircleDashed className="size-3.5 animate-spin [animation-duration:3s]" /> : i + 1}
                </span>
                <span className={cn("text-sm", status === "now" ? "text-foreground" : "text-muted")}>{step}</span>
              </li>
            ))}
          </ol>
        </GlassCard>
      </section>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  muted?: boolean;
}) {
  return (
    <GlassCard className="group p-5 transition-colors hover:border-glass-border-strong">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
        <span className="text-violet-soft/80 transition-colors group-hover:text-cyan">{icon}</span>
      </div>
      <p className={cn("mt-3 font-display text-2xl font-semibold tracking-wide", muted ? "text-subtle" : "text-foreground")}>
        {value}
      </p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </GlassCard>
  );
}
