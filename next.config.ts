import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production" && process.env.VERCEL === "1";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS só na Vercel: em localhost o navegador passaria a forçar https e o
  // servidor de desenvolvimento deixaria de abrir.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Mesmo formato do Jarvis: permite migrar para contêiner (DigitalOcean) sem mudar código.
  output: "standalone",
  poweredByHeader: false,
  // Em dev usamos http://127.0.0.1:3000 (localhost acumula cookies de outros
  // projetos e estoura o limite de cabeçalho). Sem isto o Next bloqueia o JS de dev.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
