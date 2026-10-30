import { Suspense } from "react";

import { OpportunityList } from "@/components/routes/opportunity-list";
import { RouteFilters } from "@/components/routes/route-filters";
import type { RouteFixed, RouteSearchParams } from "@/lib/opportunities";
import { createClient } from "@/lib/supabase/server";

type Fixed = RouteFixed;

async function FiltersWithLocations({ fixed }: { fixed: Fixed }) {
  const supabase = await createClient();
  const { data } = await supabase.from("locations").select("id").eq("active", true).order("sort_order");
  return <RouteFilters locations={((data ?? []) as { id: string }[]).map((l) => l.id)} fixed={fixed} />;
}

function ListSkeleton() {
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="glass h-[104px] animate-pulse rounded-2xl" />
      ))}
    </ul>
  );
}

/** Esqueleto comum de Rotas e Black Market: cabeçalho, filtros e lista. */
export function RoutesPage({
  title,
  subtitle,
  searchParams,
  fixed = {},
  eyebrow = "Mercado",
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  searchParams: Promise<RouteSearchParams>;
  fixed?: Fixed;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">{eyebrow}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </header>

      <Suspense fallback={<div className="glass h-[86px] rounded-2xl" />}>
        <FiltersWithLocations fixed={fixed} />
      </Suspense>

      <Suspense fallback={<ListSkeleton />}>
        <OpportunityList searchParams={searchParams} fixed={fixed} />
      </Suspense>
    </div>
  );
}
