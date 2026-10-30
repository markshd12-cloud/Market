"use client";

import { Check, LoaderCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { useActionState, useDeferredValue, useMemo, useState } from "react";

import { createPresetScenarios, deleteScenario, saveScenario } from "@/app/(app)/projecoes/actions";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { controlClass, Field } from "@/components/ui/field";
import { parseSilver } from "@/lib/format";
import { deterministic, monteCarlo, PRESETS, type Scenario } from "@/lib/projection";
import { cn, formatSilver } from "@/lib/utils";

/** Campos como texto (o usuário digita "10,5"); percentuais em %. */
type Draft = {
  key: string;
  id?: string;
  name: string;
  color: string;
  stake_pct: string;
  stake_cap: string;
  rotations_per_day: string;
  margin: string;
  margin_sd: string;
  loss_chance: string;
  fixed_daily: string;
  reinvest: string;
  withdraw_weekly: string;
};

const pctText = (n: number) => String(Math.round(n * 1000) / 10).replace(".", ",");
const silverText = (n: number) => (n ? n.toLocaleString("pt-BR") : "0");

function toDraft(s: Omit<Scenario, "key">, key: string, id?: string): Draft {
  return {
    key,
    id,
    name: s.name,
    color: s.color,
    stake_pct: pctText(s.stakePct),
    stake_cap: silverText(s.stakeCap),
    rotations_per_day: String(s.rotationsPerDay).replace(".", ","),
    margin: pctText(s.margin),
    margin_sd: pctText(s.marginSd),
    loss_chance: pctText(s.lossChance),
    fixed_daily: silverText(s.fixedDaily),
    reinvest: pctText(s.reinvest),
    withdraw_weekly: silverText(s.withdrawWeekly),
  };
}

const num = (s: string) => Number(s.replace(",", "."));

/** Draft → cenário para o cálculo; null se algum campo ainda não é número. */
function toScenario(d: Draft): Scenario | null {
  const s: Scenario = {
    key: d.key,
    name: d.name || "Sem nome",
    color: d.color,
    stakePct: num(d.stake_pct) / 100,
    stakeCap: parseSilver(d.stake_cap) ?? NaN,
    rotationsPerDay: num(d.rotations_per_day),
    margin: num(d.margin) / 100,
    marginSd: num(d.margin_sd) / 100,
    lossChance: num(d.loss_chance) / 100,
    fixedDaily: parseSilver(d.fixed_daily) ?? NaN,
    reinvest: num(d.reinvest) / 100,
    withdrawWeekly: parseSilver(d.withdraw_weekly) ?? NaN,
  };
  return Object.values(s).every((v) => typeof v !== "number" || Number.isFinite(v)) ? s : null;
}

const HORIZONS = [10, 20, 30, 45, 60, 90];

export function ProjectionWorkbench({
  characterId,
  start: initialStart,
  goal,
  goalDays,
  saved,
  history,
}: {
  characterId: string;
  /** Banco atual (0 = ainda não informado). */
  start: number;
  goal: number;
  goalDays: number;
  saved: Scenario[];
  history: Scenario | null;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    saved.length ? saved.map((s) => toDraft(s, s.key, s.key)) : PRESETS.map((p, i) => toDraft(p, `preset-${i}`)),
  );
  const [startText, setStartText] = useState(initialStart ? silverText(initialStart) : "20.000.000");
  const [horizon, setHorizon] = useState(HORIZONS.includes(goalDays) ? goalDays : 20);
  const [focus, setFocus] = useState<string>(saved[1]?.key ?? saved[0]?.key ?? "preset-1");

  const start = parseSilver(startText) ?? 0;
  // Os cálculos usam a versão "atrasada" do estado: digitar continua fluido.
  const deferred = useDeferredValue({ drafts, start, horizon });

  const results = useMemo(() => {
    const list = deferred.drafts.map(toScenario).filter((s): s is Scenario => s !== null);
    if (history) list.push(history);
    return list.map((s) => ({
      s,
      path: deterministic(deferred.start, deferred.horizon, s),
      mc: monteCarlo(deferred.start, deferred.horizon, goal, s, 1500),
    }));
  }, [deferred, goal, history]);

  const focused = results.find((r) => r.s.key === focus) ?? results[0];
  const update = (key: string, field: keyof Draft, value: string) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, [field]: value } : d)));
  const usingPresets = !saved.length;

  return (
    <div className="space-y-4">
      <GlassCard neon className="p-5 sm:p-6">
        <CardTitle
          title="Projeção do banco"
          subtitle="Linhas = caminho esperado de cada cenário. Faixa = 80% das simulações do cenário em destaque."
        />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Banco inicial" hint={initialStart ? "seu banco atual" : "informe o banco em Operações"}>
            <input
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              inputMode="decimal"
              className={cn(controlClass, "font-mono")}
            />
          </Field>
          <Field label="Horizonte">
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className={controlClass}>
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {h} dias
                </option>
              ))}
            </select>
          </Field>
          <Field label="Faixa provável de" className="col-span-2">
            <select value={focused?.s.key ?? ""} onChange={(e) => setFocus(e.target.value)} className={controlClass}>
              {results.map((r) => (
                <option key={r.s.key} value={r.s.key}>
                  {r.s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5">
          <ProjectionChart
            goal={goal}
            series={results.map((r) => ({ key: r.s.key, name: r.s.name, color: r.s.color, values: r.path }))}
            band={
              focused
                ? { name: `${focused.s.name} (p10–p90)`, color: focused.s.color, low: focused.mc.p10, high: focused.mc.p90 }
                : null
            }
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-glass-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/[0.03] text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Cenário</th>
                <th className="px-3 py-2.5 text-right font-medium" title="Caminho esperado no último dia">
                  Esperado D{horizon}
                </th>
                <th className="px-3 py-2.5 text-right font-medium" title="80% das simulações terminam nesta faixa">
                  Faixa provável
                </th>
                <th className="px-3 py-2.5 text-right font-medium">Chance da meta</th>
                <th className="px-3 py-2.5 text-right font-medium" title="Mediana do dia em que bate a meta">
                  Bate em
                </th>
                <th className="px-3 py-2.5 text-right font-medium" title="Terminar abaixo do banco inicial">
                  Risco de perder
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ s, path, mc }) => (
                <tr key={s.key} className="border-t border-glass-border/70">
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatSilver(path[path.length - 1])}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted">
                    {formatSilver(mc.p10[mc.p10.length - 1])} – {formatSilver(mc.p90[mc.p90.length - 1])}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-mono font-semibold",
                      mc.hitChance >= 0.7 ? "text-emerald-300" : mc.hitChance >= 0.3 ? "text-amber-300" : "text-rose-300",
                    )}
                  >
                    {Math.round(mc.hitChance * 100)}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {mc.medianDayToGoal != null ? `dia ${mc.medianDayToGoal}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted">
                    {Math.round(mc.belowStartChance * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-subtle">
          {history
            ? "“Histórico real” usa as suas operações fechadas (cada dia + local de venda = uma rotação)."
            : "“Histórico real” aparece depois de 3 rotações fechadas em Operações."}{" "}
          Simulação com 1.500 trajetórias por cenário.
        </p>
      </GlassCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide">Cenários</h2>
        <div className="flex gap-2">
          {usingPresets && (
            <form action={createPresetScenarios}>
              <input type="hidden" name="character_id" value={characterId} />
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/15 px-3 text-xs text-violet-soft hover:bg-violet/25">
                <Sparkles className="size-3.5" /> Salvar os 3 modelos
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() =>
              setDrafts((list) => [
                ...list,
                toDraft({ ...PRESETS[1], name: `Cenário ${list.length + 1}`, color: "#f472b6" }, `new-${Date.now()}`),
              ])
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-glass-border px-3 text-xs text-muted hover:text-foreground"
          >
            <Plus className="size-3.5" /> Novo cenário
          </button>
        </div>
      </div>
      {usingPresets && (
        <p className="-mt-2 text-xs text-subtle">
          Estes são os modelos prontos (doc 11). Edite à vontade: o gráfico muda na hora. Salve para guardar.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {drafts.map((d) => (
          <ScenarioEditor
            key={d.key}
            draft={d}
            characterId={characterId}
            valid={toScenario(d) !== null}
            onChange={(field, value) => update(d.key, field, value)}
            onDiscard={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}
          />
        ))}
      </div>
    </div>
  );
}

const FIELDS: { field: keyof Draft; label: string; suffix?: string; hint?: string }[] = [
  { field: "stake_pct", label: "Aposta por rotação", suffix: "% do banco" },
  { field: "stake_cap", label: "Teto por rotação", suffix: "silver" },
  { field: "rotations_per_day", label: "Rotações por dia" },
  { field: "margin", label: "Lucro médio", suffix: "%", hint: "líquido, por rotação" },
  { field: "margin_sd", label: "Variação do lucro", suffix: "%", hint: "desvio entre rotações" },
  { field: "loss_chance", label: "Chance de perder", suffix: "%", hint: "a rotação inteira" },
  { field: "fixed_daily", label: "Renda fixa/dia", suffix: "silver", hint: "ilha, craft…" },
  { field: "reinvest", label: "Reinvestir", suffix: "% do lucro" },
  { field: "withdraw_weekly", label: "Saque semanal", suffix: "silver" },
];

function ScenarioEditor({
  draft,
  characterId,
  valid,
  onChange,
  onDiscard,
}: {
  draft: Draft;
  characterId: string;
  valid: boolean;
  onChange: (field: keyof Draft, value: string) => void;
  onDiscard: () => void;
}) {
  const [state, action, pending] = useActionState(saveScenario, undefined);

  return (
    <GlassCard className="p-4 sm:p-5">
      <form action={action} className="space-y-3">
        {draft.id && <input type="hidden" name="id" value={draft.id} />}
        <input type="hidden" name="character_id" value={characterId} />
        <div className="flex items-center gap-2">
          <input
            type="color"
            name="color"
            value={draft.color}
            onChange={(e) => onChange("color", e.target.value)}
            aria-label="Cor"
            className="size-9 shrink-0 cursor-pointer rounded-lg border border-glass-border bg-transparent p-1"
          />
          <input
            name="name"
            value={draft.name}
            onChange={(e) => onChange("name", e.target.value)}
            maxLength={40}
            aria-label="Nome do cenário"
            className={cn(controlClass, "h-9 font-medium")}
          />
          {!draft.id && <span className="shrink-0 text-[0.65rem] text-amber-300">não salvo</span>}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {FIELDS.map(({ field, label, suffix, hint }) => (
            <Field key={field} label={label} hint={hint}>
              <span className={cn(controlClass, "flex h-9 items-center gap-1.5 px-2.5")}>
                <input
                  name={field}
                  value={draft[field] ?? ""}
                  onChange={(e) => onChange(field, e.target.value)}
                  inputMode="decimal"
                  className="w-full min-w-0 bg-transparent text-right font-mono text-sm focus:outline-none"
                />
                {suffix && <span className="shrink-0 text-[0.65rem] text-subtle">{suffix}</span>}
              </span>
            </Field>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || !valid}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet/40 bg-violet/15 px-3 text-xs font-medium text-violet-soft hover:bg-violet/25 disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Salvar
          </button>
          {!valid && <span className="text-xs text-amber-300">Algum campo não é número.</span>}
          {state?.error && <span className="text-xs text-rose-300">{state.error}</span>}
          {state?.ok && <span className="text-xs text-emerald-300">Salvo.</span>}
          {draft.id ? (
            <button
              type="submit"
              formAction={deleteScenario}
              onClick={(e) => {
                if (!confirm(`Apagar o cenário ${draft.name}?`)) e.preventDefault();
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs text-subtle hover:text-rose-300"
            >
              <Trash2 className="size-3.5" /> Apagar
            </button>
          ) : (
            <button
              type="button"
              onClick={onDiscard}
              className="ml-auto inline-flex items-center gap-1 text-xs text-subtle hover:text-rose-300"
            >
              <Trash2 className="size-3.5" /> Descartar
            </button>
          )}
        </div>
      </form>
    </GlassCard>
  );
}
