import { tierLabel } from "@/lib/catalog/labels";
import { cn } from "@/lib/utils";

/** Selo "T6.1" com a cor do encantamento (verde, azul, roxo, dourado). */
export function TierBadge({ tier, enchant }: { tier: number | null; enchant: number }) {
  const colors = ["", "text-emerald-300", "text-sky-300", "text-violet-300", "text-amber-300"];
  return (
    <span
      className={cn(
        "rounded-md border border-glass-border bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.65rem]",
        colors[enchant] || "text-foreground/80",
      )}
    >
      {tierLabel(tier, enchant)}
    </span>
  );
}
