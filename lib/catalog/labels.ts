/** Rótulos em português das categorias de loja do jogo (shop_category). */
export const CATEGORY_LABELS: Record<string, string> = {
  weapons: "Armas",
  offhands: "Mão secundária",
  head: "Cabeça",
  armors: "Armaduras",
  shoes: "Sapatos",
  capes: "Capas",
  bags: "Bolsas",
  mounts: "Montarias",
  consumables: "Consumíveis",
  crafting: "Materiais de craft",
  gathering: "Recursos coletados",
  farming: "Fazenda",
  artefacts: "Artefatos",
  furniture: "Mobília",
  vanity: "Cosméticos",
  other: "Outros",
};

/** Ordem dos filtros: o que mais importa para mercado primeiro. */
export const CATEGORY_ORDER = [
  "weapons",
  "offhands",
  "head",
  "armors",
  "shoes",
  "capes",
  "bags",
  "mounts",
  "consumables",
  "crafting",
  "gathering",
  "farming",
  "artefacts",
  "furniture",
  "other",
  "vanity",
];

export const categoryLabel = (key: string | null) =>
  key ? (CATEGORY_LABELS[key] ?? key) : "Sem categoria";

/** "T6" / "T6.1" como no jogo. */
export function tierLabel(tier: number | null, enchant: number) {
  if (tier == null) return "—";
  return enchant > 0 ? `T${tier}.${enchant}` : `T${tier}`;
}

const QUALITY = ["", "Normal", "Bom", "Notável", "Excelente", "Obra-prima"];

/** Qualidade do item como no jogo (1 = Normal … 5 = Obra-prima). */
export const qualityLabel = (q: number) => QUALITY[q] ?? `Q${q}`;

/** Ícone oficial do item (CDN do Albion). */
export function itemIconUrl(id: string, size = 64) {
  return `https://render.albiononline.com/v1/item/${id}.png?size=${size}`;
}
