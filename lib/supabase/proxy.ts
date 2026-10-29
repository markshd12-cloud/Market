import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

/** Rotas acessíveis sem login. */
const PUBLIC_PREFIXES = [
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/auth",
];

/** Rotas de entrada: quem já está logado é mandado para o painel. */
const GUEST_ONLY = ["/login", "/cadastro", "/recuperar-senha"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Renova a sessão do Supabase a cada request (template oficial @supabase/ssr)
 * e redireciona conforme o login. Isto é só navegação: a proteção dos dados
 * fica no RLS do banco.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!supabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Não rodar nada entre createServerClient e getClaims(): é o que mantém a
  // sessão renovada. getClaims() valida a assinatura do JWT.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Mantém os cookies renovados no redirect.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && !matches(pathname, PUBLIC_PREFIXES)) {
    return redirectTo("/login");
  }

  if (user && (pathname === "/" || matches(pathname, GUEST_ONLY))) {
    return redirectTo("/dashboard");
  }

  return response;
}
