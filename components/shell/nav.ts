import {
  ChartSpline,
  Factory,
  LayoutDashboard,
  Radar,
  Route,
  Settings,
  Ship,
  Sprout,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Módulo ainda não construído: aparece desabilitado com "em breve". */
  soon?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Visão geral",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Mercado",
    items: [
      { label: "Rotas", href: "/rotas", icon: Route, soon: true },
      { label: "Black Market", href: "/black-market", icon: Ship, soon: true },
      { label: "Reconferências", href: "/reconferencias", icon: Radar, soon: true },
    ],
  },
  {
    label: "Produção",
    items: [
      { label: "Craft", href: "/craft", icon: Factory, soon: true },
      { label: "Ilhas", href: "/ilhas", icon: Sprout, soon: true },
    ],
  },
  {
    label: "Finanças",
    items: [
      { label: "Operações", href: "/operacoes", icon: Wallet, soon: true },
      { label: "Projeções", href: "/projecoes", icon: ChartSpline, soon: true },
    ],
  },
  {
    label: "Conta",
    items: [{ label: "Configurações", href: "/configuracoes", icon: Settings, soon: true }],
  },
];
