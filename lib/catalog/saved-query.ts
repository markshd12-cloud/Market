/**
 * Última pesquisa do catálogo, por aba (sessionStorage). Mantém os filtros ao
 * abrir um item e voltar, ou ao clicar em "Catálogo" na sidebar.
 */
const KEY = "nyx:catalog-query";

export function loadCatalogQuery(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveCatalogQuery(query: string) {
  try {
    sessionStorage.setItem(KEY, query);
  } catch {
    /* armazenamento bloqueado: só não lembra */
  }
}

export const catalogHref = (query: string) => (query ? `/catalogo?${query}` : "/catalogo");
