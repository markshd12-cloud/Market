"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | undefined;

const MIN_PASSWORD = 8;

async function getOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

/** Login por e-mail e senha. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirme seu e-mail antes de entrar. Veja sua caixa de entrada." };
    }
    // Mensagem genérica: não revela se o e-mail existe.
    return { error: "E-mail ou senha inválidos." };
  }

  redirect("/dashboard");
}

/** Cadastro. A confirmação por e-mail é controlada no painel do Supabase. */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const displayName = field(formData, "displayName");
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (displayName.length < 2 || displayName.length > 32) {
    return { error: "O nome deve ter entre 2 e 32 caracteres." };
  }
  if (!email) return { error: "Informe o e-mail." };
  if (password.length < MIN_PASSWORD) {
    return { error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` };
  }
  if (password !== confirm) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${await getOrigin()}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    console.error("[signUp]", error.status, error.code, error.message);
    if (error.code === "weak_password") {
      return { error: "Senha fraca. Use letras, números e símbolos." };
    }
    if (error.code === "signup_disabled") {
      return { error: "Cadastros estão fechados no momento." };
    }
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }

  // Com confirmação de e-mail ligada não há sessão ainda.
  if (!data.session) {
    return {
      message: "Conta criada. Enviamos um link de confirmação para o seu e-mail.",
    };
  }

  redirect("/dashboard");
}

/** Envia o e-mail de redefinição de senha. */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = field(formData, "email");
  if (!email) return { error: "Informe o e-mail." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getOrigin()}/auth/confirm?next=/atualizar-senha`,
  });
  if (error) console.error("[requestPasswordReset]", error.status, error.message);

  return { message: "Se houver uma conta com esse e-mail, enviamos o link de redefinição." };
}

/** Define a nova senha (sessão vinda do link de recuperação). */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD) {
    return { error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` };
  }
  if (password !== confirm) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[updatePassword]", error.status, error.code, error.message);
    if (error.code === "same_password") {
      return { error: "A nova senha precisa ser diferente da atual." };
    }
    return { error: "O link expirou. Solicite uma nova redefinição." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
