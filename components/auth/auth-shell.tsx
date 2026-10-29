import { Radar, Route, Sprout } from "lucide-react";

import { NyxLogo, NyxMark } from "@/components/brand/nyx-logo";
import { GlassCard } from "@/components/ui/card";

const FEATURES = [
  { icon: Route, title: "Rotas e Black Market", text: "Lucro líquido por rota, com taxas e risco." },
  { icon: Sprout, title: "Produção", text: "Craft, ilhas e trabalhadores pelo seu foco." },
  { icon: Radar, title: "Reconferências", text: "O que vale conferir, e onde, antes de todos." },
];

/** Moldura das telas de entrada: vitrine à esquerda, formulário de vidro à direita. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      <div className="nyx-sky" aria-hidden />

      {/* Vitrine (desktop) */}
      <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <NyxLogo />

        <div className="relative mx-auto my-10 grid aspect-square w-full max-w-md place-items-center">
          <div className="absolute inset-0 animate-orbit rounded-full border border-dashed border-violet/25" />
          <div className="absolute inset-[12%] animate-orbit-reverse rounded-full border border-cyan/15">
            <span className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-cyan shadow-[0_0_18px_4px_rgb(34_211_238/0.6)]" />
          </div>
          <div className="absolute inset-[26%] rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.35),transparent_70%)] blur-2xl" />
          <NyxMark className="relative size-44 animate-float drop-shadow-[0_0_40px_rgb(139_92_246/0.5)]" />
        </div>

        <div className="space-y-6">
          <h1 className="max-w-lg font-display text-3xl font-semibold leading-tight tracking-wide xl:text-4xl">
            <span className="text-gradient">A noite enxerga</span> o que o mercado esconde.
          </h1>
          <ul className="grid gap-3 xl:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="glass rounded-2xl p-4">
                <Icon className="size-5 text-violet-soft" aria-hidden />
                <p className="mt-2 text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Formulário */}
      <section className="flex min-w-0 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <NyxLogo size="lg" />
          </div>

          <GlassCard strong neon className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold tracking-wide">{title}</h2>
              <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            </div>
            {children}
          </GlassCard>

          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}

          <p className="mt-8 text-center font-mono text-[0.65rem] uppercase tracking-[0.3em] text-subtle">
            Guild NYX · Albion West
          </p>
        </div>
      </section>
    </main>
  );
}
