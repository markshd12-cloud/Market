import {
  BookOpen,
  ChartSpline,
  Crosshair,
  Factory,
  LayoutDashboard,
  Radar,
  Route,
  ScanLine,
  Settings,
  Ship,
  Sprout,
  UserRound,
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
      { label: "Catálogo", href: "/catalogo", icon: BookOpen },
      { label: "Rotas", href: "/rotas", icon: Route },
      { label: "Black Market", href: "/black-market", icon: Ship },
      { label: "Meu mercado", href: "/meu-mercado", icon: Crosshair },
      { label: "Captura", href: "/captura", icon: ScanLine },
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
      { label: "Operações", href: "/operacoes", icon: Wallet },
      { label: "Projeções", href: "/projecoes", icon: ChartSpline },
    ],
  },
  {
    label: "Conta",
    items: [
      { label: "Personagens", href: "/personagens", icon: UserRound },
      { label: "Configurações", href: "/configuracoes", icon: Settings, soon: true },
    ],
  },
];
