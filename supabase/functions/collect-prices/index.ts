// =============================================================================
// NYX Market · coletor de preços (Supabase Edge Function, Deno)
//
// Cada execução processa um pedaço da lista vigiada e guarda o cursor, então
// chamadas a cada poucos minutos cobrem a lista inteira em ciclos.
//   POST {"job":"prices"}   → preços atuais        (agendar a cada 5 min)
//   POST {"job":"history"}  → volume/preço médio   (agendar a cada 10 min)
//
// Arquivo único de propósito: dá para colar no editor do painel do Supabase.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const API = "https://west.albion-online-data.com/api/v2/stats";

const JOBS = {
  // 20 chamadas × 150 itens ≈ 3.000 itens por execução.
  prices: { batchSize: 150, batchesPerRun: 20 },
  // Histórico é maior por item: lotes menores.
  history: { batchSize: 80, batchesPerRun: 8 },
} as const;

type Job = keyof typeof JOBS;

const PAUSE_MS = 350; // respiro entre chamadas (limite da API: 180/min)
const EMPTY_DATE = "0001-01-01T00:00:00";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Datas da API vêm em UTC sem "Z"; a data vazia vira null. */
const toDate = (d: string | null | undefined) => (!d || d.startsWith(EMPTY_DATE) ? null : `${d}Z`);
const positive = (n: number | null | undefined) => (n && n > 0 ? n : null);

type PriceRow = {
  item_id: string;
  city: string;
  quality: number;
  sell_price_min: number;
  sell_price_min_date: string;
  sell_price_max: number;
  sell_price_max_date: string;
  buy_price_min: number;
  buy_price_min_date: string;
  buy_price_max: number;
  buy_price_max_date: string;
};

type HistorySeries = {
  item_id: string;
  location: string;
  quality: number;
  data: { item_count: number; avg_price: number; timestamp: string }[];
};

class Throttled extends Error {}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Accept-Encoding": "gzip" } });
  const text = await res.text();
  if (res.status === 429 || text.startsWith("Throttled")) throw new Throttled(text.slice(0, 120));
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 120)}`);
  return JSON.parse(text) as T;
}

function mapPrices(rows: PriceRow[]) {
  return rows
    .filter((r) => r.sell_price_min > 0 || r.sell_price_max > 0 || r.buy_price_min > 0 || r.buy_price_max > 0)
    .map((r) => ({
      item_id: r.item_id,
      location: r.city,
      quality: r.quality,
      sell_min: positive(r.sell_price_min),
      sell_min_at: r.sell_price_min > 0 ? toDate(r.sell_price_min_date) : null,
      sell_max: positive(r.sell_price_max),
      sell_max_at: r.sell_price_max > 0 ? toDate(r.sell_price_max_date) : null,
      buy_min: positive(r.buy_price_min),
      buy_min_at: r.buy_price_min > 0 ? toDate(r.buy_price_min_date) : null,
      buy_max: positive(r.buy_price_max),
      buy_max_at: r.buy_price_max > 0 ? toDate(r.buy_price_max_date) : null,
    }));
}

/** Resume a série diária em médias de 7 e 30 dias. */
function summarize(series: HistorySeries[]) {
  const now = Date.now();
  const DAY = 86_400_000;
  return series
    .filter((s) => s.data?.length)
    .map((s) => {
      const points = s.data.map((p) => ({ ...p, t: Date.parse(`${p.timestamp}Z`) }));
      const window = (days: number) => points.filter((p) => now - p.t <= days * DAY);
      const avg = (pts: typeof points, days: number) => pts.reduce((a, p) => a + p.item_count, 0) / days;
      const weighted = (pts: typeof points) => {
        const qty = pts.reduce((a, p) => a + p.item_count, 0);
        return qty > 0 ? pts.reduce((a, p) => a + p.avg_price * p.item_count, 0) / qty : null;
      };
      const w7 = window(7);
      const w30 = window(30);
      const last = points.reduce((m, p) => Math.max(m, p.t), 0);
      return {
        item_id: s.item_id,
        location: s.location,
        quality: s.quality,
        volume_7d: Number(avg(w7, 7).toFixed(2)),
        volume_30d: Number(avg(w30, 30).toFixed(2)),
        price_7d: w7.length ? Math.round(weighted(w7)!) : null,
        price_30d: w30.length ? Math.round(weighted(w30)!) : null,
        days_sold_30d: new Set(w30.filter((p) => p.item_count > 0).map((p) => p.timestamp.slice(0, 10))).size,
        last_day: last ? new Date(last).toISOString().slice(0, 10) : null,
      };
    });
}

/** Chave de serviço: nome antigo (JWT) ou o novo formato de chaves secretas. */
function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return keys.default ?? Object.values(keys)[0];
  } catch {
    return undefined;
  }
}

Deno.serve(async (req) => {
  // Só o agendador conhece o segredo (secret COLLECTOR_SECRET da função).
  const secret = Deno.env.get("COLLECTOR_SECRET");
  if (!secret || req.headers.get("x-collector-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const job: Job = body?.job === "history" ? "history" : "prices";
  const { batchSize, batchesPerRun } = JOBS[job];

  const key = serviceKey();
  if (!key) return new Response("missing service key", { status: 500 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: run } = await supabase.from("collector_runs").insert({ job }).select("id").single();
  let requests = 0;
  let rows = 0;
  let cursor: number | undefined;

  const finish = async (ok: boolean, message: string | null, cursor?: number, cycleDone = false) => {
    const now = new Date().toISOString();
    if (run) {
      await supabase
        .from("collector_runs")
        .update({ finished_at: now, requests, rows, ok, message })
        .eq("id", run.id);
    }
    const patch: Record<string, unknown> = { last_run_at: now, last_error: ok ? null : message };
    if (ok) patch.last_ok_at = now;
    if (cursor !== undefined) patch.cursor = cursor;
    if (cycleDone) {
      const { data: s } = await supabase.from("collector_state").select("cycle").eq("job", job).single();
      patch.cycle = (s?.cycle ?? 0) + 1;
    }
    await supabase.from("collector_state").update(patch).eq("job", job);
    return Response.json({ job, ok, requests, rows, message, cursor });
  };

  try {
    const [{ data: ids, error: wlError }, { data: locs }, { data: state }] = await Promise.all([
      supabase.rpc("collector_watchlist"),
      supabase.from("locations").select("id").eq("active", true).order("sort_order"),
      supabase.from("collector_state").select("cursor").eq("job", job).single(),
    ]);
    if (wlError) throw new Error(`watchlist: ${wlError.message}`);

    const list = (ids ?? []) as string[];
    if (list.length === 0) return await finish(true, "Lista vazia: importe o catálogo e confira watch_rules.", 0);
    const locations = (locs ?? []).map((l: { id: string }) => encodeURIComponent(l.id)).join(",");

    cursor = Math.min(state?.cursor ?? 0, list.length);
    let cycleDone = false;

    for (let b = 0; b < batchesPerRun; b++) {
      if (cursor >= list.length) {
        cursor = 0;
        cycleDone = true;
        break; // fecha o ciclo nesta execução; o próximo começa do zero
      }
      const batch = list.slice(cursor, cursor + batchSize);
      const joined = batch.map(encodeURIComponent).join(",");

      if (job === "prices") {
        const data = await getJson<PriceRow[]>(`${API}/prices/${joined}.json?locations=${locations}`);
        requests++;
        const mapped = mapPrices(data);
        if (mapped.length) {
          const { data: n, error } = await supabase.rpc("ingest_prices", { p_rows: mapped });
          if (error) throw new Error(`ingest_prices: ${error.message}`);
          rows += (n as number) ?? 0;
        }
      } else {
        const data = await getJson<HistorySeries[]>(
          `${API}/history/${joined}.json?locations=${locations}&time-scale=24`,
        );
        requests++;
        const stats = summarize(data);
        if (stats.length) {
          const { data: n, error } = await supabase.rpc("ingest_market_stats", { p_rows: stats });
          if (error) throw new Error(`ingest_market_stats: ${error.message}`);
          rows += (n as number) ?? 0;
        }
      }

      cursor += batch.length;
      await sleep(PAUSE_MS);
    }

    if (cycleDone) await supabase.rpc("collector_cleanup");
    return await finish(true, null, cursor, cycleDone);
  } catch (err) {
    // Throttle/erro: o lote que falhou é repetido na próxima execução.
    const message = err instanceof Throttled ? `Limite da API: ${err.message}` : String(err instanceof Error ? err.message : err);
    // Salva o progresso dos lotes que já deram certo.
    return await finish(false, message.slice(0, 500), cursor);
  }
});
