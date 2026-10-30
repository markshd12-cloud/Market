"use client";

import { ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/utils";

import { useShell } from "./app-shell";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#7c3aed,#06b6d4)] font-display text-xs font-bold text-white shadow-[0_0_16px_-4px_rgb(139_92_246/0.8)]",
        className,
      )}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}

export function UserMenu({
  displayName,
  email,
  isAdmin = false,
}: {
  displayName: string;
  email: string;
  isAdmin?: boolean;
}) {
  const { collapsed } = useShell();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="space-y-2">
      {isAdmin && (
        <Link
          href="/admin"
          title="Administração"
          className={cn(
            "group/admin flex h-10 items-center gap-3 rounded-xl border border-violet/30 bg-violet/10 text-sm text-violet-soft transition-colors hover:border-violet/50 hover:bg-violet/20",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          <ShieldCheck className="size-[18px] shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">Administração</span>}
        </Link>
      )}
    <div ref={ref} className={cn("relative flex gap-1.5", collapsed ? "flex-col items-center" : "items-center")}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-white/[0.05]",
          collapsed ? "justify-center" : "flex-1",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={displayName} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{displayName}</span>
              <span className="block truncate text-xs text-muted">{email}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
          </>
        )}
      </button>

      {/* Sair sempre visível (o menu fica para Administração e afins). */}
      <form action={signOut}>
        <button
          type="submit"
          title="Sair"
          aria-label="Sair"
          className="grid size-9 place-items-center rounded-xl border border-glass-border text-muted transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-rose-300"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "glass-strong absolute bottom-full z-50 mb-2 w-60 rounded-2xl p-1.5",
              collapsed ? "left-0" : "inset-x-0 w-auto",
            )}
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
            <div className="my-1 h-px bg-glass-border" />
            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground/90 transition-colors hover:bg-white/[0.05]"
              >
                <ShieldCheck className="size-4 text-violet-soft" aria-hidden /> Administração
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-300 transition-colors hover:bg-danger/10"
              >
                <LogOut className="size-4" aria-hidden /> Sair
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3 p-1.5">
      <span className="size-9 shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
      <span className="flex-1 space-y-1.5">
        <span className="block h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
        <span className="block h-2.5 w-32 animate-pulse rounded bg-white/[0.04]" />
      </span>
    </div>
  );
}
