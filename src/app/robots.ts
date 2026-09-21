import type { MetadataRoute } from "next";

import { urlBase } from "@/lib/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // "/orgao" fica de fora de propósito: bloquear esse prefixo também
      // bloquearia "/orgao/solicitar" e "/orgao/definir-senha/*", que são
      // públicas. O painel privado em "/orgao" já redireciona pra /login
      // pra quem não tem sessão (proxy.ts), então não tem conteúdo real
      // pra um crawler indexar ali de qualquer forma.
      disallow: [
        "/painel",
        "/moderacao",
        "/denuncias",
        "/orgaos-categorias",
        "/solicitacoes-orgao",
        "/api/",
      ],
    },
    sitemap: `${urlBase()}/sitemap.xml`,
  };
}
