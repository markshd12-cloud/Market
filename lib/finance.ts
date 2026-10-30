import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Personagem do usuário logado (RLS: só os dele). */
export type Character = {
  id: string;
  name: string;
  premium: boolean;
  home_city: string | null;
  goal_amount: number | null;
  goal_days: number | null;
  goal_start: string;
  created_at: string;
};

export type OperationItem = { name_pt: string | null; name_en: string | null; tier: number | null; enchant: number };

export type Operation = {
  id: number;
  item_id: string;
  quality: number;
  quantity: number;
  buy_location: string | null;
  buy_price: number;
  sell_location: string | null;
  sell_price: number | null;
  sale_mode: "instant" | "order";
  fees: number;
  expected_profit: number | null;
  status: "aberta" | "vendida" | "perdida";
  opened_at: string;
  closed_at: string | null;
  note: string | null;
  profit: number | null;
  items: OperationItem | null;
};

export const CHARACTER_FIELDS = "id, name, premium, home_city, goal_amount, goal_days, goal_start, created_at";
export const OPERATION_FIELDS =
  "id, item_id, quality, quantity, buy_location, buy_price, sell_location, sell_price, sale_mode, fees, expected_profit, status, opened_at, closed_at, note, profit, items(name_pt, name_en, tier, enchant)";

/** Personagens do usuário, do mais antigo para o mais novo (o primeiro é o principal). */
export async function getCharacters(): Promise<Character[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("characters").select(CHARACTER_FIELDS).order("created_at");
  return (data ?? []) as Character[];
}

/** Escolhe o personagem pela query (?p=) ou cai no principal. */
export const pickCharacter = (list: Character[], id: string | undefined) =>
  list.find((c) => c.id === id) ?? list[0] ?? null;

export type Bank = {
  /** Último banco informado + lucro fechado depois dele. null = nunca informou. */
  current: number | null;
  snapshot: { balance: number; taken_at: string } | null;
  profitSinceSnapshot: number;
  /** Silver parado em operações abertas (custo de compra). */
  inOpenOperations: number;
};

export async function getBank(characterId: string): Promise<Bank> {
  const supabase = await createClient();
  const [{ data: snap }, { data: open }] = await Promise.all([
    supabase
      .from("balance_snapshots")
      .select("balance, taken_at")
      .eq("character_id", characterId)
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("operations").select("buy_price, quantity").eq("character_id", characterId).eq("status", "aberta"),
  ]);

  const inOpenOperations = ((open ?? []) as { buy_price: number; quantity: number }[]).reduce(
    (sum, o) => sum + o.buy_price * o.quantity,
    0,
  );

  if (!snap) return { current: null, snapshot: null, profitSinceSnapshot: 0, inOpenOperations };

  const { data: closed } = await supabase
    .from("operations")
    .select("profit")
    .eq("character_id", characterId)
    .neq("status", "aberta")
    .gt("closed_at", snap.taken_at);
  const profitSinceSnapshot = ((closed ?? []) as { profit: number | null }[]).reduce((s, o) => s + (o.profit ?? 0), 0);

  return { current: snap.balance + profitSinceSnapshot, snapshot: snap, profitSinceSnapshot, inOpenOperations };
}

/** Taxas do jogo (constantes editáveis) para estimar as taxas de uma venda. */
export async function getMarketFees() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_constants")
    .select("key, value")
    .in("key", ["market.sales_tax_premium", "market.sales_tax_free", "market.setup_fee"]);
  const get = (k: string, fallback: number) =>
    Number((data ?? []).find((c: { key: string }) => c.key === k)?.value ?? fallback) / 100;
  return {
    salesTaxPremium: get("market.sales_tax_premium", 4),
    salesTaxFree: get("market.sales_tax_free", 8),
    setupFee: get("market.setup_fee", 2.5),
  };
}

export const itemName = (op: Pick<Operation, "item_id" | "items">) =>
  op.items?.name_pt ?? op.items?.name_en ?? op.item_id;
