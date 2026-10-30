/**
 * Motor de oportunidades: tipos e leitura dos filtros da URL.
 * O cálculo mora no banco (função market_opportunities, migration 0006).
 */

export type OpportunityMode = "instant" | "order";
export type OpportunitySort = "profit" | "margin" | "confidence" | "unit";

export type Opportunity = {
  item_id: string;
  name: string;
  tier: number | null;
  enchant: number;
  shop_category: string | null;
  weight: number | null;
  quality: number;
  origin: string;
  dest: string;
  buy_price: number;
  buy_at: string;
  sell_price: number;
  sell_at: string;
  fees_unit: number;
  profit_unit: number;
  margin: number;
  qty: number;
  profit_total: number;
  volume_7d: number | null;
  days_sold_30d: number | null;
  avg_7d_origin: number | null;
  avg_7d_dest: number | null;
  confidence: number;
  flags: string[];
};

export type RouteSearchParams = {
  modo?: string;
  de?: string;
  para?: string;
  cat?: string;
  tier?: string;
  ord?: string;
  conf?: string;
  /** Janela do "Meu mercado", em horas. */
  janela?: string;
};

/** O que a página fixa: destino/modo (Black Market) ou só minhas capturas (Meu mercado). */
export type RouteFixed = { dest?: string; mode?: OpportunityMode; mine?: boolean };

export const MODE_LABELS: Record<OpportunityMode, string> = {
  instant: "Venda imediata",
  order: "Ordem de venda",
};

export const SORT_LABELS: Record<OpportunitySort, string> = {
  profit: "Lucro estimado",
  margin: "Margem",
  confidence: "Confiança",
  unit: "Lucro por unidade",
};

export const CONFIDENCE_STEPS = [0, 40, 60, 80];

/** Janelas do "Meu mercado": itens capturados nas últimas N horas. */
export const MINE_WINDOWS = [1, 3, 6, 24, 72, 168];
export const DEFAULT_MINE_WINDOW = 24;

export const FLAG_LABELS: Record<string, { label: string; hint: string; tone: "warn" | "info" | "danger" | "capture" }> = {
  sua_captura: { label: "Sua captura", hint: "Pelo menos uma ponta veio do seu Data Client.", tone: "capture" },
  zona_vermelha: { label: "Zona vermelha", hint: "A rota passa por zona de PvP com perda total.", tone: "danger" },
  preco_suspeito: {
    label: "Preço suspeito",
    hint: "Um dos preços está a mais de 2x da média de 7 dias: pode ser ordem lixo ou troll.",
    tone: "danger",
  },
  sem_historico: {
    label: "Sem histórico no destino",
    hint: "Sem volume de vendas coletado ainda; quantidade sugerida = 1.",
    tone: "warn",
  },
  origem_sem_historico: {
    label: "Sem histórico na origem",
    hint: "Não dá para saber quanto há à venda na origem; confira no jogo antes de comprar tudo.",
    tone: "info",
  },
  limite_capital: { label: "Limitado pelo capital", hint: "A quantidade parou no teto por rotação.", tone: "info" },
};

const pick = <T extends string>(value: string | undefined, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : undefined;

/** Converte a query string nos parâmetros da função do banco. */
export function rpcParams(sp: RouteSearchParams, fixed: RouteFixed = {}) {
  const tier = Number(sp.tier);
  const conf = Number(sp.conf);
  const janela = Number(sp.janela);
  return {
    // Só manda o filtro quando a página pede: /rotas segue igual.
    ...(fixed.mine ? { p_mine_hours: MINE_WINDOWS.includes(janela) ? janela : DEFAULT_MINE_WINDOW } : {}),
    p_mode: fixed.mode ?? pick(sp.modo, ["instant", "order"] as const) ?? "instant",
    p_origin: sp.de || null,
    p_dest: fixed.dest ?? (sp.para || null),
    p_category: sp.cat || null,
    p_tier: Number.isInteger(tier) && tier >= 1 && tier <= 8 ? tier : null,
    p_min_confidence: sp.conf && CONFIDENCE_STEPS.includes(conf) ? conf : null,
    p_sort: pick(sp.ord, ["profit", "margin", "confidence", "unit"] as const) ?? "profit",
    p_limit: 150,
  };
}
