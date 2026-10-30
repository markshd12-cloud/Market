import { Radio } from "lucide-react";

import { getCollectorStatus } from "@/lib/collector";
import { timeAgo } from "@/lib/format";

import { Kpi } from "./dashboard-content";

/** Indicador do coletor no dashboard (lê o banco: renderizar dentro de <Suspense>). */
export async function CollectorKpi() {
  const status = await getCollectorStatus().catch(() => null);
  const prices = status?.jobs.find((j) => j.job === "prices");

  if (!status || !prices?.last_run_at) {
    return <Kpi icon={<Radio className="size-4" />} label="Coletor" value="Offline" hint="ainda não rodou" muted />;
  }

  return (
    <Kpi
      icon={<Radio className="size-4" />}
      label="Coletor"
      value={status.online ? "Online" : "Parado"}
      hint={`${status.priceRows.toLocaleString("pt-BR")} preços · última coleta ${timeAgo(prices.last_ok_at)}`}
      muted={!status.online}
    />
  );
}

export function CollectorKpiSkeleton() {
  return <Kpi icon={<Radio className="size-4" />} label="Coletor" value="…" hint="verificando" muted />;
}
