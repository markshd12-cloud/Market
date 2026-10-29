import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Orbitron, Space_Grotesk } from "next/font/google";

import "./globals.css";

const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });
const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "NYX Market", template: "%s · NYX Market" },
  description: "Inteligência de mercado do Albion Online para a guild NYX.",
};

export const viewport: Viewport = {
  themeColor: "#05040d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${grotesk.variable} ${orbitron.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
