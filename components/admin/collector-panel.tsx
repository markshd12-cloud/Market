import { CircleCheck, CircleX, Radio } from "lucide-react";

import { CardTitle, GlassCard } from "@/components/ui/card";
import type { getCollectorStatus } from "@/lib/collector";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Status = Awaited<ReturnType<typeof getCollectorStatus>>;

const JOB_LABEL: Record<string, string> = { prices: "Preços atuais", history: "Volume e preço médio" };

export function CollectorPanel({ status }: { status: Status }) {
  return (
    <GlassCard className="p-5 sm:p-6">
      <CardTitle
        icon={<Radio className="size-4" />}
        title="Coletor de preços"
        subtitle="Edge Function collect-prices, agendada no Supabase."
        action={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              status.online
                ? "border-success/40 bg-success/10 text-emerald-300"
                : "border-glass-border text-muted",
            )}
          >
            <span className={cn("size-1.5 rounded-full", status.online ? "bg-emerald-400" : "bg-subtle")} />
            {status.online ? "Online" : "Parado"}
          </span>
        }
      />

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-glass-border bg-white/[0.02] p-3">
          <dt className="text-xs text-muted">Preços guardados</dt>
          <dd className="mt-1 font-display text-xl font-semibold">{status.priceRows.toLocaleString("pt-BR")}</dd>
        </div>
        <div className="rounded-xl border border-glass-border bg-white/[0.02] p-3">
          <dt className="text-xs text-muted">Estatísticas de volume</dt>
          <dd className="mt-1 font-display text-xl font-semibold">{status.statRows.toLocaleString("pt-BR")}</dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-2">
        {status.jobs.map((j) => (
          <li key={j.job} className="rounded-xl border border-glass-border bg-white/[0.02] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{JOB_LABEL[j.job] ?? j.job}</span>
              <span className="text-muted">ciclo {j.cycle} · posição {j.cursor.toLocaleString("pt-BR")}</span>
            </div>
            <p className="mt-1 text-muted">
              Última execução {timeAgo(j.last_run_at)} · último sucesso {timeAgo(j.last_ok_at)}
            </p>
            {j.last_error && <p className="mt-1 text-rose-300">{j.last_error}</p>}
          </li>
        ))}
      </ul>

      {status.runs.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-subtle">Últimas execuções</h3>
          <ul className="space-y-1.5">
            {status.runs.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                {r.ok === false ? (
                  <CircleX className="size-3.5 shrink-0 text-rose-400" aria-label="Falhou" />
                ) : (
                  <CircleCheck className="size-3.5 shrink-0 text-emerald-400" aria-label="OK" />
                )}
                <span className="w-24 shrink-0 text-muted">{timeAgo(r.started_at)}</span>
                <span className="shrink-0 text-foreground/80">{JOB_LABEL[r.job] ?? r.job}</span>
                <span className="ml-auto shrink-0 font-mono text-subtle">
                  {r.requests} req · {r.rows.toLocaleString("pt-BR")} linhas
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}
