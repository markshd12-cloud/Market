import type { NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** Lotes maiores que isto não vêm do client do jogo. */
const MAX_BYTES = 2_000_000;

const STATUS: Record<string, number> = { chave: 401, limite: 429, grande: 413, formato: 400 };

/**
 * Recebe o Albion Data Client rodando com  -i "<site>/api/capture/<chave>".
 * O client faz POST de JSON em <base>/<tópico> (ex.: marketorders.ingest),
 * sem cabeçalho de autenticação: a chave pessoal vai no caminho e quem a
 * confere é capture_ingest() no banco. Só a chave publishable sai daqui.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/capture/[key]/[topic]">) {
  const { key, topic } = await ctx.params;

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) {
    return Response.json({ ok: false, error: "grande" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: "json" }, { status: 400 });
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/capture_ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ p_key: key, p_topic: topic, p_payload: payload }),
    cache: "no-store",
  });

  if (!res.ok) {
    // Ordem malformada (cast falhou no banco) ou banco fora do ar.
    console.error("[capture]", topic, res.status, (await res.text()).slice(0, 300));
    return Response.json({ ok: false, error: "banco" }, { status: res.status >= 500 ? 502 : 400 });
  }

  const result = (await res.json()) as { ok: boolean; error?: string };
  return Response.json(result, { status: result.ok ? 200 : (STATUS[result.error ?? ""] ?? 400) });
}
