import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 12_500_000 → "12,5M" · 840_000 → "840k" (silver). */
export function formatSilver(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000)
    return `${(value / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}B`;
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000)
    return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return value.toLocaleString("pt-BR");
}
