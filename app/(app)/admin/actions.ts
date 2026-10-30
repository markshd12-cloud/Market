"use server";

import { revalidatePath } from "next/cache";

import { buildCatalog } from "@/lib/catalog/transform";
import { createClient } from "@/lib/supabase/server";

const DUMPS = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master";
const CHUNK = 1000;
const PARALLEL = 4;

export type ImportState =
  | { ok: true; items: number; recipes: number; ingredients: number; seconds: number; ref: string | null }
  | { ok: false; error: string }
  | undefined;

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  return res.json();
}

/** Commit atual do ao-bin-dumps (só para registro; falha não impede a importação). */
async function latestCommit() {
  try {
    const res = await fetch("https://api.github.com/repos/ao-data/ao-bin-dumps/commits/master", {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { sha?: string };
    return json.sha?.slice(0, 12) ?? null;
  } catch {
    return null;
  }
}

/** Envia linhas em lotes, alguns em paralelo. */
async function upsertAll<T>(
  rows: T[],
  send: (chunk: T[]) => PromiseLike<{ error: { message: string } | null }>,
) {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) chunks.push(rows.slice(i, i + CHUNK));
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const results = await Promise.all(chunks.slice(i, i + PARALLEL).map(send));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
}

/**
 * Baixa o ao-bin-dumps e grava itens, receitas e ingredientes.
 * Roda como o usuário logado: o RLS só deixa gravar se ele for admin.
 */
export async function importCatalog(): Promise<ImportState> {
  const started = Date.now();
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { ok: false, error: "Apenas administradores podem importar o catálogo." };

  try {
    const [formatted, raw, ref] = await Promise.all([
      fetchJson(`${DUMPS}/formatted/items.json`),
      fetchJson(`${DUMPS}/items.json`),
      latestCommit(),
    ]);
    const catalog = buildCatalog(formatted, raw);

    await upsertAll(catalog.items, (c) => supabase.from("items").upsert(c, { onConflict: "id" }));
    await upsertAll(catalog.recipes, (c) =>
      supabase.from("recipes").upsert(c, { onConflict: "item_id,variant" }),
    );
    await upsertAll(catalog.ingredients, (c) =>
      supabase.from("recipe_ingredients").upsert(c, { onConflict: "item_id,variant,resource_id" }),
    );

    await supabase.from("catalog_imports").insert({
      source: "ao-bin-dumps",
      source_ref: ref,
      items: catalog.items.length,
      recipes: catalog.recipes.length,
      ingredients: catalog.ingredients.length,
    });

    revalidatePath("/admin");
    return {
      ok: true,
      items: catalog.items.length,
      recipes: catalog.recipes.length,
      ingredients: catalog.ingredients.length,
      seconds: Math.round((Date.now() - started) / 1000),
      ref,
    };
  } catch (err) {
    console.error("[importCatalog]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Falha na importação." };
  }
}

export type ConstantState = { ok?: boolean; error?: string } | undefined;

/** Atualiza o valor/status de uma constante. O RLS barra quem não é admin. */
export async function updateConstant(_prev: ConstantState, formData: FormData): Promise<ConstantState> {
  const key = String(formData.get("key") ?? "");
  const value = Number(String(formData.get("value") ?? "").replace(",", "."));
  const status = String(formData.get("status") ?? "");

  if (!key) return { error: "Constante inválida." };
  if (!Number.isFinite(value)) return { error: "Valor precisa ser um número." };
  if (status !== "confirmado" && status !== "a_confirmar") return { error: "Status inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_constants")
    .update({ value, status })
    .eq("key", key)
    .select("key");

  if (error) return { error: "Não foi possível salvar." };
  // Sem linha devolvida = o RLS bloqueou (não é admin).
  if (!data?.length) return { error: "Sem permissão para alterar." };

  revalidatePath("/admin");
  return { ok: true };
}
