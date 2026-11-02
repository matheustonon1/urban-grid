import Link from "next/link";
import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { botaoPrimario, pagina } from "@/lib/estilos";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { metadataDaPagina } from "@/lib/metadata";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";

import { NovaReclamacaoForm } from "./form";

export const generateMetadata = metadataDaPagina("NovaReclamacao", "tituloPagina");

export default async function NovaReclamacaoPage() {
  const t = await getTranslations("NovaReclamacao");
  const session = await exigirSessao();

  // Conta de órgão não registra reclamação (a action recusa também): quem abre e quem
  // responde oficialmente não pode ser a mesma parte, senão o órgão se atende e se avalia.
  // A página explica em vez de redirecionar em silêncio a quem clicou em "Registrar".
  if (session.user.papel === "ORGAO") {
    return (
      <main className={pagina}>
        <CabecalhoPagina kicker={t("kicker")} titulo={t("tituloPagina")} />
        <EstadoVazio
          icone={Building2}
          titulo={t("orgaoNaoRegistraTitulo")}
          descricao={t("orgaoNaoRegistraDescricao")}
        >
          <Link href="/orgao" className={botaoPrimario}>
            {t("orgaoNaoRegistraAcao")}
          </Link>
        </EstadoVazio>
      </main>
    );
  }

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
    <main className={pagina}>
      <CabecalhoPagina kicker={t("kicker")} titulo={t("tituloPagina")} descricao={t("subtitulo")} />
      <NovaReclamacaoForm categorias={categorias} cidadePadrao={cidadePadrao} />
    </main>
  );
}
