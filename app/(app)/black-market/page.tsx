import type { Metadata } from "next";

import { RoutesPage } from "@/components/routes/routes-page";
import type { RouteSearchParams } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Black Market" };

export default function BlackMarketPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  return (
    <RoutesPage
      title="Black Market"
      subtitle="Comprar nas cidades e vender na hora para as ordens do Black Market, em Caerleon (zona vermelha)."
      searchParams={searchParams}
      fixed={{ dest: "Black Market", mode: "instant" }}
    />
  );
}
