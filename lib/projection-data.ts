import "server-only";

import { getBank, type Character } from "@/lib/finance";
import { historyScenario, type ClosedOp, type Scenario } from "@/lib/projection";
import { createClient } from "@/lib/supabase/server";

type ScenarioRow = {
  id: string;
  name: string;
  color: string;
  stake_pct: number;
  stake_cap: number;
  rotations_per_day: number;
  margin: number;
  margin_sd: number;
  loss_chance: number;
  fixed_daily: number;
  reinvest: number;
  withdraw_weekly: number;
};

const toScenario = (r: ScenarioRow): Scenario => ({
  key: r.id,
  name: r.name,
  color: r.color,
  stakePct: Number(r.stake_pct),
  stakeCap: Number(r.stake_cap),
  rotationsPerDay: Number(r.rotations_per_day),
  margin: Number(r.margin),
  marginSd: Number(r.margin_sd),
  lossChance: Number(r.loss_chance),
  fixedDaily: Number(r.fixed_daily),
  reinvest: Number(r.reinvest),
  withdrawWeekly: Number(r.withdraw_weekly),
});

/** Meta efetiva: a do personagem ou o plano padrão (doc 09: 100M em 20 dias). */
export const goalOf = (c: Character | null) => ({
  amount: c?.goal_amount ?? 100_000_000,
  days: c?.goal_days ?? 20,
  fromCharacter: Boolean(c?.goal_amount),
});

/** Tudo que a projeção precisa de um personagem: banco, cenários salvos e o "histórico real". */
export async function getProjectionInput(character: Character) {
  const supabase = await createClient();
  const [bank, { data: rows }, { data: ops }] = await Promise.all([
    getBank(character.id),
    supabase
      .from("scenarios")
      .select(
        "id, name, color, stake_pct, stake_cap, rotations_per_day, margin, margin_sd, loss_chance, fixed_daily, reinvest, withdraw_weekly",
      )
      .eq("character_id", character.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("operations")
      .select("status, closed_at, sell_location, buy_price, quantity, profit")
      .eq("character_id", character.id)
      .neq("status", "aberta")
      .order("closed_at", { ascending: false })
      .limit(1000),
  ]);

  const start = bank.current ?? 0;
  const history = historyScenario((ops ?? []) as ClosedOp[], start);

  return {
    bank,
    start,
    scenarios: ((rows ?? []) as ScenarioRow[]).map(toScenario),
    history: history ? ({ ...history, key: "historico", name: "Histórico real", color: "#f59e0b" } as Scenario) : null,
    closedCount: (ops ?? []).length,
  };
}
