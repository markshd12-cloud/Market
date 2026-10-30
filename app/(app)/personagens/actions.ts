"use server";

import { revalidatePath } from "next/cache";

import { parseSilver } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type CharacterState = { ok?: boolean; error?: string } | undefined;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** Cria (sem id) ou atualiza (com id) um personagem e a meta dele. */
export async function saveCharacter(_prev: CharacterState, fd: FormData): Promise<CharacterState> {
  const id = text(fd, "id");
  const name = text(fd, "name");
  const goalAmount = text(fd, "goal_amount") ? parseSilver(fd.get("goal_amount")) : null;
  const goalDays = text(fd, "goal_days") ? Number(text(fd, "goal_days")) : null;
  const goalStart = text(fd, "goal_start");

  if (name.length < 2 || name.length > 32) return { error: "Nome com 2 a 32 caracteres." };
  if (text(fd, "goal_amount") && !goalAmount) return { error: "Meta inválida (ex.: 100M)." };
  if (goalDays != null && !(Number.isInteger(goalDays) && goalDays >= 1 && goalDays <= 365))
    return { error: "Prazo entre 1 e 365 dias." };
  if (goalStart && !/^\d{4}-\d{2}-\d{2}$/.test(goalStart)) return { error: "Data de início inválida." };

  const row = {
    name,
    premium: fd.get("premium") === "on",
    home_city: text(fd, "home_city") || null,
    goal_amount: goalAmount,
    goal_days: goalDays,
    ...(goalStart ? { goal_start: goalStart } : {}),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("characters").update(row).eq("id", id)
    : await supabase.from("characters").insert(row);

  if (error) {
    console.error("[saveCharacter]", error.code, error.message);
    return { error: error.code === "23505" ? "Você já tem um personagem com esse nome." : "Não foi possível salvar." };
  }

  revalidatePath("/personagens");
  revalidatePath("/operacoes");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Apaga o personagem e, em cascata, as operações e o banco dele. */
export async function deleteCharacter(fd: FormData) {
  const id = text(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("characters").delete().eq("id", id);
  revalidatePath("/personagens");
  revalidatePath("/operacoes");
  revalidatePath("/dashboard");
}
