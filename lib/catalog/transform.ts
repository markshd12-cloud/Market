/**
 * Converte os dumps do ao-bin-dumps nas linhas das tabelas do catálogo.
 *
 * - `formatted/items.json`: todos os IDs de mercado (inclusive @1..@4) + nomes.
 * - `items.json` (bruto): tier, categorias, peso e receitas, por ID base.
 *
 * Função pura (sem rede nem banco) para poder ser testada isoladamente.
 */

export type ItemRow = {
  id: string;
  base_id: string;
  kind: string;
  tier: number | null;
  enchant: number;
  name_pt: string | null;
  name_en: string | null;
  shop_category: string | null;
  shop_subcategory: string | null;
  shop_subcategory2: string | null;
  crafting_category: string | null;
  weight: number | null;
  max_quality: number | null;
};

export type RecipeRow = {
  item_id: string;
  variant: number;
  silver: number;
  crafting_focus: number | null;
  amount_crafted: number;
  craft_time: number | null;
};

export type IngredientRow = {
  item_id: string;
  variant: number;
  resource_id: string;
  count: number;
  max_return_amount: number | null;
};

export type CatalogData = {
  items: ItemRow[];
  recipes: RecipeRow[];
  ingredients: IngredientRow[];
};

type Raw = Record<string, unknown>;
type FormattedEntry = {
  UniqueName?: string;
  LocalizedNames?: Record<string, string> | null;
};

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** "T6_MAIN_MACE@1" → { base: "T6_MAIN_MACE", enchant: 1 } */
export function splitId(id: string) {
  const at = id.lastIndexOf("@");
  if (at === -1) return { base: id, enchant: 0 };
  const level = Number(id.slice(at + 1));
  return Number.isInteger(level) ? { base: id.slice(0, at), enchant: level } : { base: id, enchant: 0 };
}

/** ID de mercado de um ingrediente: recursos encantados levam "@n". */
function ingredientId(resource: Raw) {
  const name = str(resource["@uniquename"]);
  if (!name) return null;
  const level = num(resource["@enchantmentlevel"]) ?? 0;
  return level > 0 ? `${name}@${level}` : name;
}

function indexRaw(raw: Raw) {
  const root = (raw.items ?? raw) as Raw;
  const byName = new Map<string, { kind: string; item: Raw }>();
  for (const [kind, value] of Object.entries(root)) {
    if (kind.startsWith("@") || kind === "shopcategories") continue;
    for (const item of asArray(value as Raw | Raw[])) {
      const name = str(item?.["@uniquename"]);
      if (name) byName.set(name, { kind, item });
    }
  }
  return byName;
}

/** Requisitos de craft para o nível de encantamento pedido. */
function craftingFor(item: Raw, enchant: number): Raw[] {
  if (enchant > 0) {
    const enchantments = asArray((item.enchantments as Raw | undefined)?.enchantment as Raw | Raw[]);
    const match = enchantments.find((e) => num(e["@enchantmentlevel"]) === enchant);
    if (match?.craftingrequirements) return asArray(match.craftingrequirements as Raw | Raw[]);
  }
  return asArray(item.craftingrequirements as Raw | Raw[]);
}

export function buildCatalog(formatted: FormattedEntry[], raw: Raw): CatalogData {
  const byName = indexRaw(raw);
  const items: ItemRow[] = [];
  const recipes: RecipeRow[] = [];
  const ingredients: IngredientRow[] = [];
  const seen = new Set<string>();

  for (const entry of formatted) {
    const id = entry.UniqueName;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const { base, enchant: suffixEnchant } = splitId(id);
    // Diários de trabalhador: o dump bruto traz só "T4_JOURNAL_WOOD", sem _EMPTY/_FULL.
    const found =
      byName.get(base) ?? byName.get(id) ?? byName.get(base.replace(/_(EMPTY|FULL)$/, ""));
    const item = found?.item ?? {};
    const enchant = suffixEnchant || num(item["@enchantmentlevel"]) || 0;
    const names = entry.LocalizedNames ?? {};

    items.push({
      id,
      base_id: base,
      kind: found?.kind ?? "unknown",
      tier: num(item["@tier"]),
      enchant,
      name_pt: names["PT-BR"] ?? null,
      name_en: names["EN-US"] ?? null,
      shop_category: str(item["@shopcategory"]),
      shop_subcategory: str(item["@shopsubcategory1"]),
      shop_subcategory2: str(item["@shopsubcategory2"]),
      crafting_category: str(item["@craftingcategory"]),
      weight: num(item["@weight"]),
      max_quality: num(item["@maxqualitylevel"]),
    });

    if (!found) continue;

    // Para @n o encantamento vem do sufixo; para recursos (_LEVELn) a receita é a do próprio item.
    const requirements = craftingFor(item, suffixEnchant);
    requirements.forEach((req, variant) => {
      const resources = asArray(req.craftresource as Raw | Raw[]);
      if (resources.length === 0) return;

      // Soma ingredientes repetidos na mesma variante.
      const merged = new Map<string, IngredientRow>();
      for (const res of resources) {
        const resourceId = ingredientId(res);
        const count = num(res["@count"]);
        if (!resourceId || !count) continue;
        const prev = merged.get(resourceId);
        if (prev) prev.count += count;
        else
          merged.set(resourceId, {
            item_id: id,
            variant,
            resource_id: resourceId,
            count,
            max_return_amount: num(res["@maxreturnamount"]),
          });
      }
      if (merged.size === 0) return;

      recipes.push({
        item_id: id,
        variant,
        silver: num(req["@silver"]) ?? 0,
        crafting_focus: num(req["@craftingfocus"]),
        amount_crafted: num(req["@amountcrafted"]) ?? 1,
        craft_time: num(req["@time"]),
      });
      ingredients.push(...merged.values());
    });
  }

  return { items, recipes, ingredients };
}
