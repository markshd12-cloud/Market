import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  strong = false,
  neon = false,
  ...props
}: React.ComponentProps<"div"> & { strong?: boolean; neon?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        strong ? "glass-strong" : "glass",
        neon && "neon-edge",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-glass-border bg-white/[0.04] text-violet-soft">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
