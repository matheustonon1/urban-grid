import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { urlBase } from "@/lib/url";

const STATUS_PUBLICOS = ["PUBLICADA", "EM_ANDAMENTO", "RESOLVIDA", "ARQUIVADA"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = urlBase();

  const [cidades, orgaos] = await Promise.all([
    // Só cidades com pelo menos uma reclamação pública - a esmagadora
    // maioria das 5000+ cidades cadastradas (seed do IBGE) não tem
    // nenhuma ainda, e listar todas deixaria o sitemap cheio de páginas
    // vazias ("nenhuma reclamação pública nesta cidade ainda").
    prisma.cidade.findMany({
      where: { reclamacoes: { some: { status: { in: [...STATUS_PUBLICOS] } } } },
      select: { slug: true },
    }),
    prisma.orgao.findMany({ where: { ativo: true }, select: { id: true } }),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/reclamacoes`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/termos`, changeFrequency: "yearly", priority: 0.2 },
    ...cidades.map((cidade) => ({
      url: `${base}/cidades/${cidade.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...orgaos.map((orgao) => ({
      url: `${base}/orgaos/${orgao.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
