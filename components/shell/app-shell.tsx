"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Suspense, use, useEffect, useState } from "react";

import { NyxLogo } from "@/components/brand/nyx-logo";
import { cn } from "@/lib/utils";

import { NAV, type NavItem } from "./nav";

const STORAGE_KEY = "nyx:sidebar-collapsed";

type ShellState = { collapsed: boolean };
const ShellContext = createContext<ShellState>({ collapsed: false });
export const useShell = () => use(ShellContext);

/**
 * Casca do app: sidebar de vidro retrátil no desktop (lembra a preferência)
 * e gaveta no celular. `userSlot` recebe o menu do usuário, que é carregado
 * no servidor dentro de um <Suspense>.
 */
export function AppShell({
  children,
  userSlot,
}: {
  children: React.ReactNode;
  userSlot: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      // Preferência salva só existe no navegador; ler após montar evita
      // divergência de hidratação.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* armazenamento bloqueado: segue expandida */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {
        /* ignora */
      }
      return !c;
    });
  };

  return (
    <ShellContext value={{ collapsed }}>
      <div className="nyx-sky" aria-hidden />
      <Suspense fallback={null}>
        <OnNavigate onChange={() => setMobileOpen(false)} />
      </Suspense>
      <div className="flex min-h-dvh">
        {/* Desktop */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 84 : 288 }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="sticky top-0 hidden h-dvh shrink-0 p-3 md:block"
        >
          <div className="glass-strong flex h-full flex-col rounded-3xl">
            <div className={cn("flex h-16 items-center px-4", collapsed ? "justify-center" : "justify-between")}>
              <Link href="/dashboard" aria-label="NYX Market · início">
                <NyxLogo compact={collapsed} />
              </Link>
              {!collapsed && (
                <button
                  onClick={toggle}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                  aria-label="Recolher menu"
                >
                  <PanelLeftClose className="size-4" />
                </button>
              )}
            </div>

            {collapsed && (
              <button
                onClick={toggle}
                className="mx-auto mb-2 rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                aria-label="Expandir menu"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            )}

            <NavList collapsed={collapsed} />

            <div className="border-t border-glass-border p-3">{userSlot}</div>
          </div>
        </motion.aside>

        {/* Celular: barra do topo */}
        <div className="fixed inset-x-0 top-0 z-40 p-3 md:hidden">
          <div className="glass-strong flex h-14 items-center justify-between rounded-2xl px-4">
            <Link href="/dashboard" aria-label="NYX Market · início">
              <NyxLogo />
            </Link>
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-foreground"
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        {/* Celular: gaveta */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              />
              <motion.aside
                key="drawer"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 340, damping: 36 }}
                className="fixed inset-y-0 left-0 z-50 w-[min(86vw,300px)] p-3 md:hidden"
              >
                <div className="glass-strong flex h-full flex-col rounded-3xl">
                  <div className="flex h-16 items-center justify-between px-4">
                    <NyxLogo />
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-foreground"
                      aria-label="Fechar menu"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  <NavList collapsed={false} />
                  <div className="border-t border-glass-border p-3">{userSlot}</div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 px-4 pb-10 pt-24 sm:px-6 md:pt-6 lg:px-10">{children}</main>
      </div>
    </ShellContext>
  );
}

/**
 * O caminho atual só existe na hora da requisição (rotas dinâmicas), então
 * quem lê usePathname fica dentro de <Suspense>; o fallback é a mesma lista
 * sem item ativo, e a casca continua pré-renderizada.
 */
function NavList({ collapsed }: { collapsed: boolean }) {
  return (
    <Suspense fallback={<NavListView pathname={null} collapsed={collapsed} />}>
      <NavListWithPath collapsed={collapsed} />
    </Suspense>
  );
}

function NavListWithPath({ collapsed }: { collapsed: boolean }) {
  return <NavListView pathname={usePathname()} collapsed={collapsed} />;
}

/** Chama onChange a cada troca de rota (fecha a gaveta do celular). */
function OnNavigate({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onChange(), [pathname]);
  return null;
}

function NavListView({ pathname, collapsed }: { pathname: string | null; collapsed: boolean }) {
  return (
    <nav
      className={cn(
        "flex-1 space-y-5 px-3 py-2",
        // Recolhida: sem rolagem, para as dicas dos ícones não serem cortadas.
        collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden",
      )}
    >
      {NAV.map((group) => (
        <div key={group.label}>
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-glass-border" />
          ) : (
            <p className="mb-1.5 px-3 font-mono text-[0.62rem] uppercase tracking-[0.25em] text-subtle">
              {group.label}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={pathname?.startsWith(item.href) ?? false} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const base = cn(
    "group/nav relative flex h-10 items-center gap-3 rounded-xl text-sm transition-colors",
    collapsed ? "justify-center px-0" : "px-3",
  );

  const content = (
    <>
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl border border-violet/40 bg-[linear-gradient(90deg,rgb(139_92_246/0.22),rgb(34_211_238/0.06))] shadow-[0_0_24px_-6px_rgb(139_92_246/0.6)]"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
        />
      )}
      <Icon
        className={cn(
          "relative size-[18px] shrink-0",
          active ? "text-cyan" : item.soon ? "text-subtle" : "text-muted group-hover/nav:text-foreground",
        )}
        aria-hidden
      />
      {!collapsed && (
        <span className={cn("relative flex-1 truncate", active ? "text-foreground" : item.soon ? "text-subtle" : "text-muted group-hover/nav:text-foreground")}>
          {item.label}
        </span>
      )}
      {!collapsed && item.soon && (
        <span className="relative rounded-md border border-glass-border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-subtle">
          em breve
        </span>
      )}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg glass-strong px-2.5 py-1.5 text-xs text-foreground opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100">
          {item.label}
          {item.soon && <span className="ml-1.5 text-subtle">· em breve</span>}
        </span>
      )}
    </>
  );

  if (item.soon) {
    return (
      <div className={cn(base, "cursor-not-allowed")} aria-disabled title={collapsed ? undefined : "Em breve"}>
        {content}
      </div>
    );
  }

  return (
    <Link href={item.href} className={cn(base, !active && "hover:bg-white/[0.04]")} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}
