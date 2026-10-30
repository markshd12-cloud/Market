import type { Metadata } from "next";

import { RoutesPage } from "@/components/routes/routes-page";
import type { RouteSearchParams } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Rotas" };

export default function RotasPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  return (
    <RoutesPage
      title="Rotas"
      subtitle="Comprar barato numa cidade e vender em outra: lucro líquido, quantidade e confiança."
      searchParams={searchParams}
    />
  );
}
