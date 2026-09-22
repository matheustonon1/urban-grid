import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Content Security Policy pragmática: bloqueia scripts/objetos de
// origem arbitrária (a principal defesa contra XSS de terceiros), mas
// ainda permite o que o app realmente usa - o Turnstile (challenges.
// cloudflare.com), o script inline de tema em layout.tsx (por isso
// 'unsafe-inline' em script-src; um nonce por request seria mais
// forte, mas exige middleware próprio) e imagens do Vercel Blob (domínio
// dinâmico, por isso "https:" amplo em img-src em vez de um host fixo).
// Em desenvolvimento o React usa eval() pra reconstruir stack traces do
// overlay de erro (nunca em produção, conforme o próprio aviso do
// React) - sem 'unsafe-eval' aqui, só o overlay de dev perde esse
// detalhe, mas é mais simples e mais seguro liberar só fora de produção.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "production" ? "" : "'unsafe-eval' "}https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
