import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CollectorJob = {
  job: "prices" | "history";
  cursor: number;
  cycle: number;
  last_run_at: string | null;
  last_ok_at: string | null;
  last_error: string | null;
};

export type CollectorRun = {
  id: number;
  job: string;
  started_at: string;
  finished_at: string | null;
  requests: number;
  rows: number;
  ok: boolean | null;
  message: string | null;
};

/** Online = última execução bem-sucedida de preços há menos de 20 min. */
export const ONLINE_WINDOW_MIN = 20;

export async function getCollectorStatus() {
  const supabase = await createClient();
  const [{ data: state }, { data: runs }, { count: prices }, { count: stats }] = await Promise.all([
    supabase.from("collector_state").select("*").order("job"),
    supabase.from("collector_runs").select("*").order("started_at", { ascending: false }).limit(8),
    supabase.from("price_latest").select("item_id", { count: "exact", head: true }),
    supabase.from("market_stats").select("item_id", { count: "exact", head: true }),
  ]);

  const jobs = (state ?? []) as CollectorJob[];
  const pricesJob = jobs.find((j) => j.job === "prices");
  const lastOk = pricesJob?.last_ok_at ? Date.parse(pricesJob.last_ok_at) : 0;
  const online = Date.now() - lastOk < ONLINE_WINDOW_MIN * 60_000;

  return {
    online,
    jobs,
    runs: (runs ?? []) as CollectorRun[],
    priceRows: prices ?? 0,
    statRows: stats ?? 0,
  };
}
