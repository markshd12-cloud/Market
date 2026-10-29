import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Marca NYX: lua crescente (a deusa da noite) cortada por uma linha de
 * mercado em alta que termina numa estrela.
 */
export function NyxMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const ring = `nyx-ring-${id}`;
  const moon = `nyx-moon-${id}`;
  const line = `nyx-line-${id}`;
  const cut = `nyx-cut-${id}`;
  const glow = `nyx-glow-${id}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("size-10", className)}
    >
      <defs>
        <linearGradient id={ring} x1="6" y1="6" x2="58" y2="58">
          <stop stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#8b5cf6" stopOpacity="0.5" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={moon} x1="14" y1="12" x2="44" y2="52">
          <stop stopColor="#f5f3ff" />
          <stop offset="0.5" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={line} x1="12" y1="46" x2="52" y2="16">
          <stop stopColor="#8b5cf6" stopOpacity="0" />
          <stop offset="0.35" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <mask id={cut}>
          <rect width="64" height="64" fill="white" />
          <circle cx="40" cy="25" r="16" fill="black" />
        </mask>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Órbita */}
      <circle cx="32" cy="32" r="29" stroke={`url(#${ring})`} strokeWidth="1.5" opacity="0.8" />
      <circle cx="32" cy="32" r="24" stroke="white" strokeOpacity="0.06" strokeWidth="1" />

      {/* Lua crescente */}
      <circle cx="30" cy="34" r="19" fill={`url(#${moon})`} mask={`url(#${cut})`} />

      {/* Linha de mercado em alta */}
      <polyline
        points="10,46 21,38 28,42 37,31 50,18"
        stroke={`url(#${line})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glow})`}
      />

      {/* Estrela no topo da alta */}
      <path
        d="M50 11.5 L51.6 16.4 L56.5 18 L51.6 19.6 L50 24.5 L48.4 19.6 L43.5 18 L48.4 16.4 Z"
        fill="#e0fbff"
        filter={`url(#${glow})`}
      />
    </svg>
  );
}

/** Marca + nome. `compact` mostra só a marca (sidebar recolhida). */
export function NyxLogo({
  className,
  compact = false,
  size = "md",
}: {
  className?: string;
  compact?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <NyxMark className={size === "lg" ? "size-16" : "size-9"} />
      {!compact && (
        <div className="leading-none">
          <div
            className={cn(
              "font-display font-bold tracking-[0.32em] text-gradient",
              size === "lg" ? "text-4xl" : "text-lg",
            )}
          >
            NYX
          </div>
          <div
            className={cn(
              "mt-1 font-mono uppercase tracking-[0.45em] text-muted",
              size === "lg" ? "text-xs" : "text-[0.6rem]",
            )}
          >
            Market
          </div>
        </div>
      )}
    </div>
  );
}
