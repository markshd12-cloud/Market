import { Wallet } from "lucide-react";

import { getBank, getCharacters } from "@/lib/finance";
import { requestTime, timeAgo } from "@/lib/format";
import { formatSilver } from "@/lib/utils";

import { Kpi } from "./dashboard-content";

/** Banco do personagem principal (lê o banco: renderizar dentro de <Suspense>). */
export async function BankKpi() {
  const [main] = await getCharacters().catch(() => []);
  if (!main) {
    return <Kpi icon={<Wallet className="size-4" />} label="Banco atual" value="—" hint="crie um personagem" muted />;
  }

  const bank = await getBank(main.id).catch(() => null);
  if (bank?.current == null) {
    return (
      <Kpi icon={<Wallet className="size-4" />} label="Banco atual" value="—" hint={`informe o banco de ${main.name}`} muted />
    );
  }

  const progress = main.goal_amount ? ` · ${Math.round((bank.current / main.goal_amount) * 100)}% da meta` : "";
  return (
    <Kpi
      icon={<Wallet className="size-4" />}
      label="Banco atual"
      value={formatSilver(bank.current)}
      hint={`${main.name} · anotado ${timeAgo(bank.snapshot?.taken_at, requestTime())}${progress}`}
    />
  );
}

export function BankKpiSkeleton() {
  return <Kpi icon={<Wallet className="size-4" />} label="Banco atual" value="…" hint="carregando" muted />;
}
