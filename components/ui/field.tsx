import { cn } from "@/lib/utils";

/** Visual comum de input/select compacto (filtros e formulários). */
export const controlClass =
  "h-11 w-full rounded-xl border border-glass-border bg-black/25 px-3 text-sm text-foreground placeholder:text-subtle focus:border-violet/60 focus:outline-none";

/** Rótulo pequeno em cima do controle. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[0.7rem] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.65rem] text-subtle">{hint}</span>}
    </label>
  );
}
