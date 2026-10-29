import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/**
 * Client do Supabase para Server Components, Server Actions e Route Handlers.
 * Sempre com a chave publishable + cookies do usuário: toda consulta passa
 * pelo RLS como o próprio usuário. Não existe service role neste app.
 *
 * Lê cookies(), então quem chama precisa estar dentro de um <Suspense>
 * (Cache Components).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado de um Server Component: não pode gravar cookie.
          // O proxy renova a sessão a cada request, então dá para ignorar.
        }
      },
    },
  });
}
