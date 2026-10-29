import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
};

/**
 * Usuário logado (Data Access Layer). getUser() confirma a sessão no servidor
 * de Auth do Supabase; o perfil vem da tabela `profiles`, protegida por RLS.
 * Lê cookies → chamar dentro de <Suspense>. `cache` evita repetir a consulta
 * quando vários componentes pedem o usuário no mesmo request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const email = user.email ?? "";
  return {
    id: user.id,
    email,
    displayName:
      profile?.display_name ||
      (user.user_metadata?.display_name as string | undefined) ||
      email.split("@")[0],
  };
});
