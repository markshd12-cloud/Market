"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type KeyState = { key?: string; error?: string } | undefined;

/**
 * Gera uma chave pessoal de captura. A chave volta UMA vez para a tela; no
 * banco fica só o SHA-256 (o mesmo que capture_ingest() calcula).
 */
export async function createCaptureKey(_prev: KeyState, fd: FormData): Promise<KeyState> {
  const label = String(fd.get("label") ?? "").trim().slice(0, 40) || "Meu PC";
  const key = `nyx_${randomBytes(24).toString("base64url")}`;

  const supabase = await createClient();
  const { error } = await supabase.from("capture_keys").insert({
    label,
    key_hash: createHash("sha256").update(key).digest("hex"),
    key_prefix: key.slice(0, 10),
  });
  if (error) {
    console.error("[createCaptureKey]", error.code, error.message);
    return { error: "Não foi possível gerar a chave." };
  }

  revalidatePath("/captura");
  return { key };
}

/** Revoga: o client que usa essa chave para de gravar na hora. */
export async function revokeCaptureKey(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("capture_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/captura");
}
