import { Activity, KeyRound, ListChecks, PackageSearch, Radar, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

import { CommandLine, KeyGenerator } from "@/components/capture/key-generator";
import { ItemIcon } from "@/components/catalog/item-icon";
import { TierBadge } from "@/components/catalog/tier-badge";
import { qualityLabel } from "@/lib/catalog/labels";
import { CardTitle, GlassCard } from "@/components/ui/card";
import { captureCommand } from "@/lib/capture";
import { requestTime, silver, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { revokeCaptureKey } from "./actions";

export const metadata: Metadata = { title: "Captura" };

type CaptureKey = {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type Captured = {
  item_id: string;
  location: string;
  quality: number;
  sell_min: number | null;
  buy_max: number | null;
  updated_at: string;
  items: { name_pt: string | null; name_en: string | null; tier: number | null; enchant: number } | null;
};

type Batch = {
  id: number;
  received_at: string;
  topic: string;
  orders: number;
  accepted: number;
  rows: number;
  skipped: Record<string, string[]> | null;
  sample: unknown;
};

const SKIP_LABELS: Record<string, string> = {
  local_desconhecido: "Local sem mapeamento",
  item_desconhecido: "Item fora do catálogo",
  tipo_desconhecido: "Tipo de ordem desconhecido",
};

/** URL pública do site, para montar o comando do client. */
async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "127.0.0.1:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("127.") || host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function CaptureContent() {
  const supabase = await createClient();
  const [baseUrl, { data: keysData }, { data: batchData }, { data: capturedData }] = await Promise.all([
    siteUrl(),
    supabase
      .from("capture_keys")
      .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("capture_batches")
      .select("id, received_at, topic, orders, accepted, rows, skipped, sample")
      .order("received_at", { ascending: false })
      .limit(30),
    supabase
      .from("price_latest")
      .select("item_id, location, quality, sell_min, buy_max, updated_at, items(name_pt, name_en, tier, enchant)")
      .eq("source", "capture")
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);
  const captured = (capturedData ?? []) as unknown as Captured[];
  const now = requestTime();
  const keys = (keysData ?? []) as CaptureKey[];
  const batches = (batchData ?? []) as Batch[];
  const local = baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost");
  const lastHour = batches.filter((b) => now - Date.parse(b.received_at) < 3_600_000);

  return (
    <div className="space-y-4">
      <GlassCard neon className="p-5 sm:p-6">
        <CardTitle
          icon={<Radar className="size-4" />}
          title="Como funciona"
          subtitle="O Albion Data Client lê o mercado que aparece na sua tela e manda só para o NYX."
        />
        <ol className="mt-5 space-y-4 text-sm">
          <Step n={1} title="Instale o Npcap">
            Baixe em{" "}
            <a href="https://npcap.com/#download" target="_blank" rel="noreferrer" className="text-violet-soft hover:underline">
              npcap.com
            </a>{" "}
            e marque <b>“WinPcap API-compatible Mode”</b> na instalação.
          </Step>
          <Step n={2} title="Baixe o Albion Data Client">
            Versão para Windows em{" "}
            <a
              href="https://github.com/ao-data/albiondata-client/releases"
              target="_blank"
              rel="noreferrer"
              className="text-violet-soft hover:underline"
            >
              github.com/ao-data/albiondata-client/releases
            </a>
            . Não precisa instalar como serviço: vamos rodar pelo terminal.
          </Step>
          <Step n={3} title="Gere sua chave e copie o comando">
            O <code className="font-mono text-cyan">-i</code> troca o destino padrão (a API pública) pelo NYX: nada do
            que você captura vai para a comunidade.
          </Step>
          <Step n={4} title="Rode o comando na pasta do client e abra o mercado no jogo">
            Cada página de ordens que você abre (venda ou compra) entra aqui em segundos e já vale para Rotas e Black
            Market.
          </Step>
        </ol>
        {local && (
          <p className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200">
            Você está no site local ({baseUrl}): o comando só funciona com o <code>npm run dev</code> rodando neste PC.
            Quando o site estiver na Vercel, gere o comando por lá para capturar sem depender do PC ligado.
          </p>
        )}
      </GlassCard>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GlassCard className="p-5 sm:p-6">
          <CardTitle
            icon={<KeyRound className="size-4" />}
            title="Chaves pessoais"
            subtitle="Uma por PC. Revogue se vazar: o client para de gravar na hora."
          />
          <div className="mt-5 space-y-4">
            <KeyGenerator baseUrl={baseUrl} />
            {keys.length > 0 && (
              <ul className="space-y-2">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-glass-border bg-white/[0.02] px-3 py-2.5 text-sm",
                      k.revoked_at && "opacity-50",
                    )}
                  >
                    <span className="font-medium">{k.label}</span>
                    <span className="font-mono text-xs text-subtle">{k.key_prefix}…</span>
                    <span className="text-xs text-muted">
                      {k.revoked_at
                        ? "revogada"
                        : k.last_used_at
                          ? `último envio ${timeAgo(k.last_used_at, now)}`
                          : "nunca usada"}
                    </span>
                    {!k.revoked_at && (
                      <form action={revokeCaptureKey} className="ml-auto">
                        <input type="hidden" name="id" value={k.id} />
                        <button className="text-xs text-subtle hover:text-rose-300">Revogar</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Formato do comando (troque CHAVE pela sua):</p>
              <CommandLine text={captureCommand(baseUrl, "CHAVE")} />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <CardTitle
            icon={<ShieldCheck className="size-4" />}
            title="Regras"
            subtitle="O que o NYX faz com a captura"
          />
          <ul className="mt-5 space-y-2.5 text-sm text-muted">
            <li>• O client só <b className="text-foreground">lê</b> os pacotes de rede do jogo; não mexe no jogo.</li>
            <li>• Entra no banco de preços comum do NYX (você, irmão, amigos), com a marca “captura própria”.</li>
            <li>• Captura nova vale mais que dado velho da API pública; a API não sobrescreve o que é mais recente.</li>
            <li>
              • Só ordens de mercado por enquanto. Histórico e ouro chegam no log, mas são ignorados.
            </li>
            <li>
              • Sua chave fica só como hash no banco. Não compartilhe sua conta do Albion nem sua chave.
            </li>
          </ul>
        </GlassCard>
      </section>

      <GlassCard className="p-5 sm:p-6">
        <CardTitle
          icon={<PackageSearch className="size-4" />}
          title="Itens capturados"
          subtitle={
            captured.length
              ? "Os últimos preços que vieram do seu client. Clique para ver o item com todos os mercados."
              : "Nenhum preço capturado ainda."
          }
        />
        {captured.length > 0 && (
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {captured.map((c) => (
              <li key={`${c.item_id}:${c.location}:${c.quality}`}>
                <Link
                  href={`/catalogo/${encodeURIComponent(c.item_id)}`}
                  className="flex items-center gap-2.5 rounded-xl border border-glass-border bg-white/[0.02] p-2 transition-colors hover:border-violet/40"
                >
                  <ItemIcon id={c.item_id} size={64} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{c.items?.name_pt ?? c.items?.name_en ?? c.item_id}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-muted">
                      {c.items && <TierBadge tier={c.items.tier} enchant={c.items.enchant} />}
                      {qualityLabel(c.quality)} · {c.location} · {timeAgo(c.updated_at, now)}
                    </span>
                  </span>
                  <span className="text-right font-mono text-xs">
                    {c.sell_min != null && <span className="block">{silver(c.sell_min)}</span>}
                    {c.buy_max != null && <span className="block text-muted">compra {silver(c.buy_max)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <CardTitle
          icon={<Activity className="size-4" />}
          title="Recebido"
          subtitle={
            batches.length
              ? `${lastHour.length} lotes na última hora · ${lastHour.reduce((s, b) => s + b.rows, 0)} preços atualizados`
              : "Nada recebido ainda. Rode o client e abra o mercado no jogo."
          }
        />
        {batches.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-glass-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Quando</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Ordens</th>
                  <th className="px-3 py-2.5 text-right font-medium">Aceitas</th>
                  <th className="px-3 py-2.5 text-right font-medium">Preços gravados</th>
                  <th className="px-3 py-2.5 font-medium">Ficou de fora</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-glass-border/70 align-top">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{timeAgo(b.received_at, now)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{b.topic}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{b.orders}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{b.accepted}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-300">{b.rows}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {b.skipped &&
                        Object.entries(b.skipped).map(([k, v]) => (
                          <p key={k} className="text-amber-300">
                            {SKIP_LABELS[k] ?? k}: <span className="font-mono">{v.join(", ")}</span>
                          </p>
                        ))}
                      {b.sample != null && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-subtle hover:text-foreground">Amostra crua</summary>
                          <pre className="mt-1 max-w-md overflow-x-auto rounded-lg bg-black/40 p-2 font-mono text-[0.65rem] text-muted">
                            {JSON.stringify(b.sample, null, 1)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-violet/40 bg-violet/10 font-mono text-xs text-violet-soft">
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-muted">{children}</p>
      </div>
    </li>
  );
}

export default function CapturePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-subtle">Mercado</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-wide sm:text-3xl">Captura própria</h1>
        <p className="mt-1 text-sm text-muted">
          Os preços que você vê no jogo, direto no NYX, sem passar pela API pública.
        </p>
      </header>
      <Suspense fallback={<GlassCard className="h-96 animate-pulse" />}>
        <CaptureContent />
      </Suspense>
      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <ListChecks className="size-3.5" /> O primeiro lote mostra a amostra crua:
        confira se o preço bate com o do jogo (o divisor fica em Administração → Captura).
      </p>
    </div>
  );
}
