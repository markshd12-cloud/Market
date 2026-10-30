"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { catalogHref, loadCatalogQuery } from "@/lib/catalog/saved-query";

/** Volta ao catálogo com a mesma pesquisa e filtros de antes. */
export function BackToCatalog() {
  const [href, setHref] = useState("/catalogo");

  // A pesquisa salva só existe no navegador.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHref(catalogHref(loadCatalogQuery())), []);

  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
      <ArrowLeft className="size-4" /> Catálogo
    </Link>
  );
}
