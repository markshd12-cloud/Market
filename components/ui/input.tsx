"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
};

/** Campo com rótulo, ícone à esquerda e (para senha) botão de mostrar/ocultar. */
export function Input({ label, icon, hint, type = "text", id, name, className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? name;
  const isPassword = type === "password";

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </label>
      <div
        className={cn(
          "group flex h-11 items-center gap-2.5 rounded-xl border border-glass-border bg-black/25 px-3.5",
          "transition-colors focus-within:border-violet/60 focus-within:bg-black/35 focus-within:shadow-[0_0_0_3px_rgb(139_92_246/0.15)]",
          className,
        )}
      >
        {icon && <span className="text-subtle transition-colors group-focus-within:text-violet-soft">{icon}</span>}
        <input
          id={inputId}
          name={name}
          type={isPassword && visible ? "text" : type}
          className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-subtle focus:outline-none"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="text-subtle transition-colors hover:text-foreground"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}
