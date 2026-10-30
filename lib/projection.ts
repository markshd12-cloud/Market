/**
 * Motor de projeção da meta (puro: roda no servidor e no navegador).
 * Um cenário descreve rotações de compra/venda; a projeção aplica dia a dia.
 */

export type ScenarioParams = {
  /** Fração do banco arriscada por rotação (0–1). */
  stakePct: number;
  /** Teto em silver por rotação (0 = sem teto). */
  stakeCap: number;
  /** Rotações por dia (pode ser fracionário: 1,5 = uma por dia e outra em dia sim, dia não). */
  rotationsPerDay: number;
  /** Lucro líquido médio de uma rotação que dá certo (0,1 = 10%). */
  margin: number;
  /** Variação da margem entre rotações (desvio-padrão, mesma unidade). */
  marginSd: number;
  /** Chance de perder a rotação inteira (morte, saque). */
  lossChance: number;
  /** Renda fixa por dia (ilha, craft, trabalhadores). */
  fixedDaily: number;
  /** Fração do lucro que volta para o banco (o resto é gasto). */
  reinvest: number;
  /** Saque fixo a cada 7 dias (equipamento de HCE, etc.). */
  withdrawWeekly: number;
};

export type Scenario = ScenarioParams & { key: string; name: string; color: string };

/** Modelos prontos (doc 11): Conservador / Moderado / Agressivo. */
export const PRESETS: Omit<Scenario, "key">[] = [
  {
    name: "Conservador",
    color: "#22d3ee",
    stakePct: 0.3,
    stakeCap: 5_000_000,
    rotationsPerDay: 1,
    margin: 0.08,
    marginSd: 0.05,
    lossChance: 0.02,
    fixedDaily: 0,
    reinvest: 1,
    withdrawWeekly: 0,
  },
  {
    name: "Moderado",
    color: "#a78bfa",
    stakePct: 0.5,
    stakeCap: 10_000_000,
    rotationsPerDay: 2,
    margin: 0.1,
    marginSd: 0.07,
    lossChance: 0.03,
    fixedDaily: 0,
    reinvest: 1,
    withdrawWeekly: 0,
  },
  {
    name: "Agressivo",
    color: "#34d399",
    stakePct: 0.7,
    stakeCap: 10_000_000,
    rotationsPerDay: 2,
    margin: 0.14,
    marginSd: 0.1,
    lossChance: 0.06,
    fixedDaily: 0,
    reinvest: 1,
    withdrawWeekly: 0,
  },
];

const stakeOf = (bank: number, s: ScenarioParams) => {
  const stake = Math.max(0, bank) * s.stakePct;
  return s.stakeCap > 0 ? Math.min(stake, s.stakeCap) : stake;
};

/** Lucro do dia (antes de reinvestir) aplicado ao banco; devolve o banco novo. */
function endOfDay(bank: number, profit: number, day: number, s: ScenarioParams) {
  let next = bank + (profit > 0 ? profit * s.reinvest : profit) + s.fixedDaily;
  if (s.withdrawWeekly > 0 && day % 7 === 0) next -= s.withdrawWeekly;
  return Math.max(0, next);
}

/** Caminho esperado: cada rotação rende a média ponderada pela chance de perda. */
export function deterministic(start: number, days: number, s: ScenarioParams): number[] {
  const expected = (1 - s.lossChance) * s.margin - s.lossChance;
  const out = [start];
  let bank = start;
  for (let day = 1; day <= days; day++) {
    let profit = 0;
    let rotations = s.rotationsPerDay;
    while (rotations > 0) {
      const share = Math.min(1, rotations); // rotação parcial = aposta proporcional
      profit += stakeOf(bank + profit, s) * share * expected;
      rotations -= 1;
    }
    bank = endOfDay(bank, profit, day, s);
    out.push(Math.round(bank));
  }
  return out;
}

/** Gerador com semente: o mesmo cenário dá o mesmo resultado no servidor e no navegador. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number) {
  // Box-Muller
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

export type MonteCarlo = {
  /** Percentis 10, 50 e 90 do banco em cada dia. */
  p10: number[];
  p50: number[];
  p90: number[];
  /** Chance de bater a meta até o último dia. */
  hitChance: number;
  /** Mediana do dia em que bate a meta (null se menos da metade bate). */
  medianDayToGoal: number | null;
  /** Chance de terminar abaixo do capital inicial. */
  belowStartChance: number;
};

/** Milhares de trajetórias com perdas e margens sorteadas. */
export function monteCarlo(
  start: number,
  days: number,
  goal: number,
  s: ScenarioParams,
  runs = 2000,
  seed = 42,
): MonteCarlo {
  const rand = mulberry32(seed);
  const byDay: Float64Array[] = Array.from({ length: days + 1 }, () => new Float64Array(runs));
  const hitDays: number[] = [];
  let belowStart = 0;

  for (let r = 0; r < runs; r++) {
    let bank = start;
    let hit: number | null = start >= goal ? 0 : null;
    byDay[0][r] = bank;
    for (let day = 1; day <= days; day++) {
      let profit = 0;
      const whole = Math.floor(s.rotationsPerDay);
      const rotations = whole + (rand() < s.rotationsPerDay - whole ? 1 : 0);
      for (let k = 0; k < rotations; k++) {
        const stake = stakeOf(bank + profit, s);
        if (rand() < s.lossChance) profit -= stake;
        else profit += stake * (s.margin + s.marginSd * normal(rand));
      }
      bank = endOfDay(bank, profit, day, s);
      byDay[day][r] = bank;
      if (hit == null && bank >= goal) hit = day;
    }
    if (hit != null) hitDays.push(hit);
    if (bank < start) belowStart++;
  }

  const pct = (arr: Float64Array, p: number) => {
    const sorted = Float64Array.from(arr).sort();
    return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]);
  };
  hitDays.sort((a, b) => a - b);

  return {
    p10: byDay.map((d) => pct(d, 0.1)),
    p50: byDay.map((d) => pct(d, 0.5)),
    p90: byDay.map((d) => pct(d, 0.9)),
    hitChance: hitDays.length / runs,
    medianDayToGoal: hitDays.length >= runs / 2 ? hitDays[Math.floor(runs / 2)] : null,
    belowStartChance: belowStart / runs,
  };
}

/** Operação fechada mínima para tirar premissas do histórico. */
export type ClosedOp = {
  status: "vendida" | "perdida";
  closed_at: string;
  sell_location: string | null;
  buy_price: number;
  quantity: number;
  profit: number | null;
};

/**
 * "Histórico real": cada (dia de fechamento, local de venda) conta como uma
 * rotação. Precisa de pelo menos 3 rotações para valer alguma coisa.
 */
export function historyScenario(ops: ClosedOp[], bank: number): ScenarioParams | null {
  const groups = new Map<string, { cost: number; profit: number; lost: boolean; day: string }>();
  for (const o of ops) {
    const day = o.closed_at.slice(0, 10);
    const key = `${day}|${o.sell_location ?? "?"}`;
    const g = groups.get(key) ?? { cost: 0, profit: 0, lost: false, day };
    g.cost += o.buy_price * o.quantity;
    g.profit += o.profit ?? 0;
    g.lost ||= o.status === "perdida";
    groups.set(key, g);
  }
  const list = [...groups.values()].filter((g) => g.cost > 0);
  if (list.length < 3) return null;

  const won = list.filter((g) => !g.lost);
  const returns = won.map((g) => g.profit / g.cost);
  const margin = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const sd = returns.length > 1
    ? Math.sqrt(returns.reduce((a, r) => a + (r - margin) ** 2, 0) / (returns.length - 1))
    : 0.05;

  const days = [...new Set(list.map((g) => g.day))].sort();
  const span = Math.max(1, (Date.parse(days[days.length - 1]) - Date.parse(days[0])) / 86_400_000 + 1);
  const avgCost = list.reduce((a, g) => a + g.cost, 0) / list.length;

  return {
    stakePct: bank > 0 ? Math.min(1, avgCost / bank) : 0.5,
    stakeCap: 0,
    rotationsPerDay: Math.round((list.length / span) * 10) / 10,
    margin,
    marginSd: sd,
    lossChance: (list.length - won.length) / list.length,
    fixedDaily: 0,
    reinvest: 1,
    withdrawWeekly: 0,
  };
}
