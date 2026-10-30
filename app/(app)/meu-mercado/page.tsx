import type { Metadata } from "next";

import { RoutesPage } from "@/components/routes/routes-page";
import type { RouteSearchParams } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Meu mercado" };

export default function MeuMercadoPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  return (
    <RoutesPage
      eyebrow="Captura própria"
      title="Meu mercado"
      subtitle="Só os itens que você viu no jogo com o Data Client: o que vale a pena dentro do que você filtrou."
      searchParams={searchParams}
      fixed={{ mine: true }}
    />
  );
}
