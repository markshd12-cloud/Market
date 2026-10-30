import { Check, CircleDashed, CircleDot } from "lucide-react";

import { CardTitle, GlassCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ROADMAP = [
  { step: "Base do site e login", status: "done" },
  { step: "Catálogo de itens e constantes", status: "done" },
  { step: "Coletor de preços (Supabase)", status: "done" },
  { step: "Motor de rotas e Black Market", status: "done" },
  { step: "Perfil, operações e meta", status: "done" },
  { step: "Projeções e cenários", status: "done" },
  { step: "Captura própria (Data Client)", status: "now" },
] as const;

/**
 * Corpo do dashboard. Tudo que lê o banco chega como slot já envolvido em
 * <Suspense> pelo page.tsx: a moldura aparece na hora.
 */
export function DashboardContent({
  greeting,
  goalKpis,
  bank,
  collector,
  projection,
}: {
  greeting: React.ReactNode;
  /** Meta e ritmo necessário (do personagem principal). */
  goalKpis: React.ReactNode;
  /** Banco do personagem principal. */
  bank: React.ReactNode;
  /** Indicador do coletor. */
  collector: React.ReactNode;
  /** Cartão do gráfico de projeção. */
  projection: React.ReactNode;
}) {
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
        {goalKpis}
        {bank}
        {collector}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">{projection}</div>

        <GlassCard className="p-5 sm:p-6">
          <CardTitle icon={<CircleDot className="size-4" />} title="Construção" subtitle="Roteiro do NYX Market" />
          <ol className="mt-5 space-y-3">
            {ROADMAP.map(({ step, status }, i) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg border font-mono text-[0.65rem]",
                    status === "now"
                      ? "border-violet/50 bg-violet/15 text-violet-soft shadow-[0_0_14px_-2px_rgb(139_92_246/0.7)]"
                      : status === "done"
                        ? "border-success/40 bg-success/10 text-emerald-300"
                        : "border-glass-border text-subtle",
                  )}
                >
                  {status === "now" ? (
                    <CircleDashed className="size-3.5 animate-spin [animation-duration:3s]" />
                  ) : status === "done" ? (
                    <Check className="size-3.5" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    status === "now" ? "text-foreground" : status === "done" ? "text-muted line-through decoration-white/20" : "text-muted",
                  )}
                >
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </GlassCard>
      </section>
    </div>
  );
}

export function Kpi({
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
