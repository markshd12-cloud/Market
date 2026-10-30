import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  /** Só para mostrar/esconder telas. Quem barra a escrita é o RLS (is_admin()). */
  isAdmin: boolean;
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

  const [{ data: profile }, { data: isAdmin, error: adminError }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("is_admin"),
  ]);
  if (adminError) console.error("[getCurrentUser] is_admin", adminError.code, adminError.message);

  const email = user.email ?? "";
  return {
    id: user.id,
    email,
    isAdmin: isAdmin === true,
    displayName:
      profile?.display_name ||
      (user.user_metadata?.display_name as string | undefined) ||
      email.split("@")[0],
  };
});
