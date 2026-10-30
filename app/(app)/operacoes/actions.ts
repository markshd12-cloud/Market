"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMarketFees } from "@/lib/finance";
import { parseSilver } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/** `at` muda a cada sucesso: o formulário usa como key para se limpar. */
export type FormState = { ok?: boolean; error?: string; at?: number } | undefined;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optional = (fd: FormData, key: string) => text(fd, key) || null;
const int = (fd: FormData, key: string) => {
  const n = Number(text(fd, key).replace(/[.\s]/g, ""));
  return Number.isInteger(n) ? n : NaN;
};

function done() {
  revalidatePath("/operacoes");
  revalidatePath("/dashboard");
  return { ok: true, at: Date.now() };
}

/** Registra uma compra (operação aberta). O RLS garante que o personagem é do usuário. */
export async function createOperation(_prev: FormState, fd: FormData): Promise<FormState> {
  const characterId = text(fd, "character_id");
  const itemId = text(fd, "item_id");
  const quantity = int(fd, "quantity");
  const quality = int(fd, "quality") || 1;
  const buyPrice = parseSilver(fd.get("buy_price"));
  const expected = text(fd, "expected_profit") ? parseSilver(fd.get("expected_profit")) : null;
  const saleMode = text(fd, "sale_mode") === "order" ? "order" : "instant";

  if (!characterId) return { error: "Escolha um personagem." };
  if (!itemId) return { error: "Escolha o item." };
  if (!(quantity > 0)) return { error: "Quantidade precisa ser maior que zero." };
  if (quality < 1 || quality > 5) return { error: "Qualidade inválida." };
  if (buyPrice == null) return { error: "Preço de compra inválido (ex.: 12.500 ou 1,2M)." };

  const supabase = await createClient();
  const { error } = await supabase.from("operations").insert({
    character_id: characterId,
    item_id: itemId,
    quality,
    quantity,
    buy_location: optional(fd, "buy_location"),
    buy_price: buyPrice,
    sell_location: optional(fd, "sell_location"),
    sale_mode: saleMode,
    expected_profit: expected,
    note: optional(fd, "note")?.slice(0, 280) ?? null,
  });

  if (error) {
    console.error("[createOperation]", error.code, error.message);
    return { error: error.code === "23503" ? "Item ou personagem não encontrado." : "Não foi possível registrar." };
  }
  // Veio do botão das rotas: tira o pré-preenchimento da URL.
  if (fd.get("from_route")) {
    done();
    redirect(`/operacoes?p=${encodeURIComponent(characterId)}`);
  }
  return done();
}

/** Fecha uma operação: vendida (com preço) ou perdida (morte, saque, etc.). */
export async function closeOperation(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = int(fd, "id");
  const outcome = text(fd, "outcome") === "perdida" ? "perdida" : "vendida";
  const saleMode = text(fd, "sale_mode") === "order" ? "order" : "instant";
  if (!(id > 0)) return { error: "Operação inválida." };

  const supabase = await createClient();
  const { data: op } = await supabase
    .from("operations")
    .select("quantity, characters(premium)")
    .eq("id", id)
    .eq("status", "aberta")
    .maybeSingle();
  if (!op) return { error: "Operação não encontrada ou já fechada." };

  if (outcome === "perdida") {
    const { error } = await supabase
      .from("operations")
      .update({ status: "perdida", closed_at: new Date().toISOString(), fees: 0, sell_price: null })
      .eq("id", id);
    if (error) return { error: "Não foi possível salvar." };
    return done();
  }

  const sellPrice = parseSilver(fd.get("sell_price"));
  if (sellPrice == null) return { error: "Preço de venda inválido." };

  // Taxas: o que o usuário digitou, ou a estimativa pelas constantes do jogo.
  let fees = text(fd, "fees") ? parseSilver(fd.get("fees")) : null;
  if (text(fd, "fees") && fees == null) return { error: "Taxas inválidas." };
  if (fees == null) {
    const rates = await getMarketFees();
    const premium = (op.characters as unknown as { premium: boolean } | null)?.premium ?? true;
    const rate = (premium ? rates.salesTaxPremium : rates.salesTaxFree) + (saleMode === "order" ? rates.setupFee : 0);
    fees = Math.round(sellPrice * op.quantity * rate);
  }

  const { error } = await supabase
    .from("operations")
    .update({
      status: "vendida",
      closed_at: new Date().toISOString(),
      sell_price: sellPrice,
      sell_location: optional(fd, "sell_location"),
      sale_mode: saleMode,
      fees,
    })
    .eq("id", id);
  if (error) {
    console.error("[closeOperation]", error.code, error.message);
    return { error: "Não foi possível salvar." };
  }
  return done();
}

/** Desfaz o fechamento (lançou errado). */
export async function reopenOperation(fd: FormData) {
  const id = int(fd, "id");
  if (!(id > 0)) return;
  const supabase = await createClient();
  await supabase
    .from("operations")
    .update({ status: "aberta", closed_at: null, sell_price: null, fees: 0 })
    .eq("id", id);
  done();
}

export async function deleteOperation(fd: FormData) {
  const id = int(fd, "id");
  if (!(id > 0)) return;
  const supabase = await createClient();
  await supabase.from("operations").delete().eq("id", id);
  done();
}

/** Registra quanto há no banco agora (o jogo não expõe o saldo). */
export async function saveBalance(_prev: FormState, fd: FormData): Promise<FormState> {
  const characterId = text(fd, "character_id");
  const balance = parseSilver(fd.get("balance"));
  if (!characterId) return { error: "Escolha um personagem." };
  if (balance == null) return { error: "Valor inválido (ex.: 18.400.000 ou 18,4M)." };

  const supabase = await createClient();
  const { error } = await supabase.from("balance_snapshots").insert({
    character_id: characterId,
    balance,
    note: optional(fd, "note")?.slice(0, 120) ?? null,
  });
  if (error) return { error: "Não foi possível salvar." };
  return done();
}
