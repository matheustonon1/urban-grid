import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { containerPagina } from "@/lib/estilos";
import { exigirSessao } from "@/lib/sessao";
import { metadataDaPagina } from "@/lib/metadata";
import { CabecalhoPagina } from "@/components/cabecalho-pagina";

import { NovaReclamacaoForm } from "./form";

export const generateMetadata = metadataDaPagina("NovaReclamacao", "tituloPagina");

export default async function NovaReclamacaoPage() {
  const t = await getTranslations("NovaReclamacao");
  const session = await exigirSessao();

  const [categorias, usuario] = await Promise.all([
    prisma.categoria.findMany({
      where: { ativa: true },
      orderBy: { ordem: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { cidade: { select: { id: true, nome: true, estado: { select: { uf: true } } } } },
    }),
  ]);

  const cidadePadrao = usuario?.cidade
    ? { id: usuario.cidade.id, nome: usuario.cidade.nome, uf: usuario.cidade.estado.uf }
    : null;

  return (
    <main className={`${containerPagina} max-w-xl`}>
      <CabecalhoPagina titulo={t("tituloPagina")} descricao={t("subtitulo")} />
      <NovaReclamacaoForm categorias={categorias} cidadePadrao={cidadePadrao} />
    </main>
  );
}
