import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline";

const variants: Record<Variant, string> = {
  primary:
    "text-white bg-[linear-gradient(110deg,#7c3aed,#8b5cf6_40%,#06b6d4)] bg-[length:200%_100%] bg-left hover:bg-right glow-violet",
  ghost: "text-foreground/80 hover:text-foreground hover:bg-white/5",
  outline:
    "glass text-foreground/90 hover:border-glass-border-strong hover:bg-white/[0.06]",
};

export function Button({
  className,
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium",
        "transition-[background-position,background-color,border-color,color,opacity] duration-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
