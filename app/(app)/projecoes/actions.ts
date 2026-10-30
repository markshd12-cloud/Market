"use server";

import { revalidatePath } from "next/cache";

import { parseSilver } from "@/lib/format";
import { PRESETS } from "@/lib/projection";
import { createClient } from "@/lib/supabase/server";

export type ScenarioState = { ok?: boolean; error?: string } | undefined;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
/** "10" ou "10,5" (em %) → 0,1 / 0,105. */
const percent = (fd: FormData, key: string) => {
  const n = Number(text(fd, key).replace(",", "."));
  return Number.isFinite(n) ? n / 100 : NaN;
};
const decimal = (fd: FormData, key: string) => Number(text(fd, key).replace(",", "."));

function done() {
  revalidatePath("/projecoes");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Cria (sem id) ou atualiza um cenário. Os limites também estão no banco (checks). */
export async function saveScenario(_prev: ScenarioState, fd: FormData): Promise<ScenarioState> {
  const id = text(fd, "id");
  const row = {
    name: text(fd, "name").slice(0, 40),
    color: text(fd, "color"),
    stake_pct: percent(fd, "stake_pct"),
    stake_cap: parseSilver(fd.get("stake_cap")) ?? 0,
    rotations_per_day: decimal(fd, "rotations_per_day"),
    margin: percent(fd, "margin"),
    margin_sd: percent(fd, "margin_sd"),
    loss_chance: percent(fd, "loss_chance"),
    fixed_daily: parseSilver(fd.get("fixed_daily")) ?? 0,
    reinvest: percent(fd, "reinvest"),
    withdraw_weekly: parseSilver(fd.get("withdraw_weekly")) ?? 0,
  };

  if (!row.name) return { error: "Dê um nome ao cenário." };
  if (!/^#[0-9a-fA-F]{6}$/.test(row.color)) return { error: "Cor inválida." };
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "number" && !Number.isFinite(v)) return { error: `Valor inválido em ${k}.` };
  }
  if (row.stake_pct < 0 || row.stake_pct > 1) return { error: "Aposta entre 0 e 100% do banco." };
  if (row.loss_chance < 0 || row.loss_chance > 1) return { error: "Chance de perda entre 0 e 100%." };
  if (row.reinvest < 0 || row.reinvest > 1) return { error: "Reinvestimento entre 0 e 100%." };
  if (row.rotations_per_day < 0 || row.rotations_per_day > 12) return { error: "Rotações por dia entre 0 e 12." };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("scenarios").update(row).eq("id", id)
    : await supabase.from("scenarios").insert({ ...row, character_id: text(fd, "character_id") });

  if (error) {
    console.error("[saveScenario]", error.code, error.message);
    return { error: error.code === "23514" ? "Algum valor está fora do limite." : "Não foi possível salvar." };
  }
  return done();
}

export async function deleteScenario(fd: FormData) {
  const id = text(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("scenarios").delete().eq("id", id);
  done();
}

/** Cria os três modelos prontos (Conservador / Moderado / Agressivo) para o personagem. */
export async function createPresetScenarios(fd: FormData) {
  const characterId = text(fd, "character_id");
  if (!characterId) return;
  const supabase = await createClient();
  const { error } = await supabase.from("scenarios").insert(
    PRESETS.map((p, i) => ({
      character_id: characterId,
      name: p.name,
      color: p.color,
      stake_pct: p.stakePct,
      stake_cap: p.stakeCap,
      rotations_per_day: p.rotationsPerDay,
      margin: p.margin,
      margin_sd: p.marginSd,
      loss_chance: p.lossChance,
      fixed_daily: p.fixedDaily,
      reinvest: p.reinvest,
      withdraw_weekly: p.withdrawWeekly,
      sort_order: i,
    })),
  );
  if (error) console.error("[createPresetScenarios]", error.code, error.message);
  done();
}
